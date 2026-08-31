# Denis, 30/08/2026, prompt #15 (§O dell'addendum): registro condiviso di
# Motori, popolato da register_process() -- MAI un dizionario statico
# scritto a mano qui. Un modulo dominio (es. erpv6_tracking, in un prompt
# futuro) lo importa e ci si registra al proprio caricamento, senza che
# erpv6_core_engine debba dipendere da quel modulo per sapere che esiste.
SAFE_PROCESSES = {}


def register_process(key, label, family, run_func):
    if key in SAFE_PROCESSES:
        raise ValueError(
            "process_key '%s' gia' registrato -- possibile doppia registrazione o "
            "collisione di nome." % key
        )
    SAFE_PROCESSES[key] = {'label': label, 'family': family, 'run': run_func}
