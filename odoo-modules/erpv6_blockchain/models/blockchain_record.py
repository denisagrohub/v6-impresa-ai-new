from odoo import models, fields, api
from datetime import datetime, timedelta
import logging
import base64
import hashlib

_logger = logging.getLogger(__name__)

DISCLAIMER_NON_DISPONIBILE = (
    "Certificazione non ancora completata: la transazione e' stata inviata "
    "ma la conferma on-chain e' in corso (Bitcoin puo' impiegare 5-60 min)."
)

OTS_CALENDARS = [
    'https://a.pool.opentimestamps.org',
    'https://b.pool.opentimestamps.org',
    'https://a.pool.eternitywall.com',
    'https://ots.btc.catallaxy.com',
]


class BlockchainRecord(models.Model):
    _name = 'erpv6.blockchain.record'
    _description = 'Record Blockchain'
    _order = 'create_date desc'

    config_id = fields.Many2one('erpv6.blockchain.config', required=True, domain=[('active', '=', True)])
    provider = fields.Selection(related='config_id.provider', string='Provider', store=True, readonly=True)

    document_model = fields.Char(required=True)
    document_id = fields.Integer(required=True)
    document_name = fields.Char()
    document_hash = fields.Char(required=True, help='SHA-256 hex del documento')
    lot_number = fields.Char()

    # Polygon / EVM
    tx_hash = fields.Char(readonly=True)
    block_number = fields.Integer(readonly=True)
    gas_used = fields.Integer(readonly=True)
    gas_cost_eth = fields.Float(readonly=True)

    # OpenTimestamps (Bitcoin)
    ots_proof = fields.Binary('Proof .ots (Base64)', readonly=True, attachment=True)
    ots_proof_b64 = fields.Text('Proof .ots (testo)', readonly=True)
    ots_submitted_at = fields.Datetime(readonly=True)
    ots_confirmed_at = fields.Datetime(readonly=True)
    ots_merkle_root = fields.Char(readonly=True, help='Root del Merkle tree Bitcoin (se disponibile)')

    status = fields.Selection([
        ('pending', 'In Attesa'),
        ('submitted', 'Inviato al provider'),
        ('confirmed', 'Confermato on-chain'),
        ('failed', 'Fallito'),
    ], default='pending', required=True)

    error_message = fields.Text(readonly=True)
    disclaimer = fields.Text(string='Nota di Trasparenza', readonly=True)

    # ─────────────────────────────────────────────────────────────
    # OPEN TIMESTAMPS
    # ─────────────────────────────────────────────────────────────
    def action_anchor_opentimestamps(self):
        """Ancora l'hash del documento su Bitcoin via OpenTimestamps (gratuito).

        Il flusso:
        1. Prendi l'hash SHA-256 del documento (32 byte)
        2. Invia ai calendar server OpenTimestamps (4 whitelisted)
        3. Ricevi la proof aggregata
        4. Salva il .ots serializzato (base64) nel record
        """
        self.ensure_one()

        if not self.document_hash:
            self.write({'status': 'failed', 'error_message': 'document_hash mancante'})
            return False

        try:
            from opentimestamps.core.timestamp import Timestamp
            from opentimestamps.core.serialize import BytesSerializationContext
            from opentimestamps.calendar import RemoteCalendar
        except ImportError as e:
            self.write({'status': 'failed', 'error_message': f'Libreria opentimestamps non installata: {e}'})
            return False

        try:
            # SHA-256 del documento (bytes)
            digest = bytes.fromhex(self.document_hash)
            if len(digest) != 32:
                raise ValueError(f'document_hash non e\' SHA-256 valido (atteso 32 byte, ricevuto {len(digest)})')

            file_timestamp = Timestamp(digest)

            successful_calendars = []
            errors = []
            for url in OTS_CALENDARS:
                try:
                    calendar = RemoteCalendar(url)
                    remote_ts = calendar.submit(digest, timeout=10)
                    file_timestamp.merge(remote_ts)
                    successful_calendars.append(url)
                except Exception as e:
                    errors.append(f'{url}: {e}')
                    _logger.warning('OTS calendar %s fallito: %s', url, e)

            if not successful_calendars:
                raise Exception('Nessun calendar OTS raggiungibile. Errori: ' + ' | '.join(errors))

            # Serializza la proof in formato .ots
            ctx = BytesSerializationContext()
            file_timestamp.serialize(ctx)
            serialized = ctx.getbytes()
            proof_b64 = base64.b64encode(serialized).decode('ascii')

            self.write({
                'status': 'submitted',
                'ots_proof_b64': proof_b64,
                'ots_submitted_at': fields.Datetime.now(),
                'error_message': False,
                'disclaimer': DISCLAIMER_NON_DISPONIBILE + f' ({len(successful_calendars)} calendar contattati)',
            })
            _logger.info('OTS anchor OK per record %s (%d calendar)', self.id, len(successful_calendars))
            return True

        except Exception as e:
            _logger.exception('OTS anchor fallito per record %s', self.id)
            self.write({'status': 'failed', 'error_message': str(e)})
            return False

    def action_verify_ots(self):
        """Verifica la proof OTS: prova a risalire al Merkle root Bitcoin.

        Nota: ritorna 'pending' finche' Bitcoin non ha confermato (5-60 min).
        Si puo' ri-eseguire in cron per aggiornare lo stato.
        """
        self.ensure_one()
        if self.provider != 'opentimestamps' or not self.ots_proof_b64:
            return False

        try:
            from opentimestamps.core.timestamp import Timestamp, DetachedTimestampFile
            from opentimestamps.core.serialize import BytesDeserializationContext
            from opentimestamps.core.op import OpSHA256
        except ImportError:
            return False

        try:
            serialized = base64.b64decode(self.ots_proof_b64)
            ctx = BytesDeserializationContext(serialized)
            timestamp = Timestamp.deserialize(ctx, bytes.fromhex(self.document_hash))

            if timestamp.all_attestations():
                # Ci sono attestazioni Bitcoin complete
                self.write({
                    'status': 'confirmed',
                    'ots_confirmed_at': fields.Datetime.now(),
                    'disclaimer': False,
                })
                return True
            return False
        except Exception as e:
            _logger.warning('Verifica OTS fallita: %s', e)
            return False

    # ─────────────────────────────────────────────────────────────
    # POLYGON / EVM
    # ─────────────────────────────────────────────────────────────
    def action_certify_polygon(self):
        """Ancora l'hash su Polygon/EVM inviando una transazione.

        Senza contract_address: invia tx a se stesso con hash nel campo 'data'.
        Con contract_address: chiama registerHash(bytes32) sullo smart contract.
        """
        self.ensure_one()

        if self.provider != 'polygon':
            self.write({'status': 'failed', 'error_message': 'Config non Polygon'})
            return False

        try:
            from web3 import Web3
        except ImportError:
            self.write({'status': 'failed', 'error_message': 'web3 non installato'})
            return False

        try:
            cfg = self.config_id
            w3 = Web3(Web3.HTTPProvider(cfg.rpc_url))
            if not w3.is_connected():
                raise Exception(f'RPC non raggiungibile: {cfg.rpc_url}')

            private_key = cfg.get_decrypted_private_key()
            if not private_key:
                raise Exception('Private key non configurata')

            account = w3.eth.account.from_key(private_key)
            from_addr = account.address

            digest = bytes.fromhex(self.document_hash)
            if len(digest) != 32:
                raise ValueError('document_hash non SHA-256 valido')

            nonce = w3.eth.get_transaction_count(from_addr)
            gas_price = w3.eth.gas_price

            if cfg.contract_address and cfg.contract_address != '0x0000000000000000000000000000000000000000':
                # Chiamata smart contract registerHash(bytes32)
                abi = [{
                    'inputs': [{'internalType': 'bytes32', 'name': 'hash', 'type': 'bytes32'}],
                    'name': 'registerHash',
                    'outputs': [],
                    'stateMutability': 'nonpayable',
                    'type': 'function',
                }]
                contract = w3.eth.contract(address=Web3.to_checksum_address(cfg.contract_address), abi=abi)
                tx = contract.functions.registerHash(digest).build_transaction({
                    'from': from_addr,
                    'nonce': nonce,
                    'gas': cfg.gas_limit or 100000,
                    'gasPrice': gas_price,
                    'chainId': w3.eth.chain_id,
                })
            else:
                # Nessun contratto: invia tx self con hash nel data field
                tx = {
                    'from': from_addr,
                    'to': from_addr,
                    'value': 0,
                    'nonce': nonce,
                    'gas': 30000,
                    'gasPrice': gas_price,
                    'data': '0x' + self.document_hash,
                    'chainId': w3.eth.chain_id,
                }

            signed = w3.eth.account.sign_transaction(tx, private_key=private_key)
            tx_hash_bytes = w3.eth.send_raw_transaction(signed.raw_transaction)
            tx_hash_hex = tx_hash_bytes.hex()
            if not tx_hash_hex.startswith('0x'):
                tx_hash_hex = '0x' + tx_hash_hex

            self.write({
                'status': 'submitted',
                'tx_hash': tx_hash_hex,
                'error_message': False,
            })
            _logger.info('Polygon tx inviata: %s', tx_hash_hex)
            return True

        except Exception as e:
            _logger.exception('Polygon tx fallita per record %s', self.id)
            self.write({'status': 'failed', 'error_message': str(e)})
            return False

    # ─────────────────────────────────────────────────────────────
    # DISPATCH GENERICO
    # ─────────────────────────────────────────────────────────────
    def action_certify(self):
        """Dispatch: chiama il metodo giusto per il provider configurato."""
        self.ensure_one()
        if self.provider == 'opentimestamps':
            return self.action_anchor_opentimestamps()
        elif self.provider == 'polygon':
            return self.action_certify_polygon()
        else:
            self.write({'status': 'failed', 'error_message': f'Provider sconosciuto: {self.provider}'})
            return False
