"""Mappatura statica province italiane -> regione (Fase 1C.1, 21/08/2026).

Dato pubblico, immutabile, zero ambiguita' -- su richiesta esplicita
dell'utente, NON un nuovo modello Odoo, solo tabella di lookup di supporto
all'estrazione (vive in erpv6_devtools/, non nel DB).

NOTA (corretta il 21/08/2026, prima di qualunque estrazione reale): il tipo
di nodo "Regione" e' stato generalizzato in "AreaTerritoriale" con un
attributo sottotipo (regione, zona_montana, comune_specifico,
zona_industriale, zona_svantaggiata...) -- caso reale che l'ha reso
necessario: il bando "Fondo deindustrializzazione" si applica a comuni
specifici dei consorzi industriali di Lazio/Marche, non a intere regioni.
Questa mappatura resta valida SOLO per il sottotipo 'regione' -- per gli
altri sottotipi non esiste una mappatura automatica possibile, va popolata
caso per caso quando si incontra un bando che la richiede (stesso principio
di flagged_missing_data se il documento non specifica i comuni esatti).

Chiave: codice provincia a 2 lettere come compare REALMENTE in
`res.country.state` per l'Italia su questa istanza (111 voci, verificate
via introspezione il 21/08/2026 -- include le 4 province sarde soppresse/
riaccorpate nel 2016, Carbonia-Iglesias/CI, Medio Campidano/VS, Ogliastra/OG,
Olbia-Tempio/OT, che Odoo mantiene comunque come dato storico: mappate a
Sardegna come le altre, cosi' la lookup copre TUTTI i codici davvero
presenti nel DB, non solo le 107 province attuali).
"""

PROVINCE_TO_REGION = {
    # Valle d'Aosta
    'AO': 'Valle d\'Aosta',
    # Piemonte
    'AL': 'Piemonte', 'AT': 'Piemonte', 'BI': 'Piemonte', 'CN': 'Piemonte',
    'NO': 'Piemonte', 'TO': 'Piemonte', 'VB': 'Piemonte', 'VC': 'Piemonte',
    # Liguria
    'GE': 'Liguria', 'IM': 'Liguria', 'SP': 'Liguria', 'SV': 'Liguria',
    # Lombardia
    'BG': 'Lombardia', 'BS': 'Lombardia', 'CO': 'Lombardia', 'CR': 'Lombardia',
    'LC': 'Lombardia', 'LO': 'Lombardia', 'MN': 'Lombardia', 'MI': 'Lombardia',
    'MB': 'Lombardia', 'PV': 'Lombardia', 'SO': 'Lombardia', 'VA': 'Lombardia',
    # Trentino-Alto Adige
    'BZ': 'Trentino-Alto Adige', 'TN': 'Trentino-Alto Adige',
    # Veneto
    'BL': 'Veneto', 'PD': 'Veneto', 'RO': 'Veneto', 'TV': 'Veneto',
    'VE': 'Veneto', 'VR': 'Veneto', 'VI': 'Veneto',
    # Friuli-Venezia Giulia
    'GO': 'Friuli-Venezia Giulia', 'PN': 'Friuli-Venezia Giulia',
    'TS': 'Friuli-Venezia Giulia', 'UD': 'Friuli-Venezia Giulia',
    # Emilia-Romagna
    'BO': 'Emilia-Romagna', 'FE': 'Emilia-Romagna', 'FC': 'Emilia-Romagna',
    'MO': 'Emilia-Romagna', 'PR': 'Emilia-Romagna', 'PC': 'Emilia-Romagna',
    'RA': 'Emilia-Romagna', 'RE': 'Emilia-Romagna', 'RN': 'Emilia-Romagna',
    # Toscana
    'AR': 'Toscana', 'FI': 'Toscana', 'GR': 'Toscana', 'LI': 'Toscana',
    'LU': 'Toscana', 'MS': 'Toscana', 'PI': 'Toscana', 'PT': 'Toscana',
    'PO': 'Toscana', 'SI': 'Toscana',
    # Umbria
    'PG': 'Umbria', 'TR': 'Umbria',
    # Marche
    'AN': 'Marche', 'AP': 'Marche', 'FM': 'Marche', 'MC': 'Marche', 'PU': 'Marche',
    # Lazio
    'FR': 'Lazio', 'LT': 'Lazio', 'RI': 'Lazio', 'RM': 'Lazio', 'VT': 'Lazio',
    # Abruzzo
    'AQ': 'Abruzzo', 'CH': 'Abruzzo', 'PE': 'Abruzzo', 'TE': 'Abruzzo',
    # Molise
    'CB': 'Molise', 'IS': 'Molise',
    # Campania
    'AV': 'Campania', 'BN': 'Campania', 'CE': 'Campania', 'NA': 'Campania', 'SA': 'Campania',
    # Puglia
    'BA': 'Puglia', 'BT': 'Puglia', 'BR': 'Puglia', 'FG': 'Puglia', 'LE': 'Puglia', 'TA': 'Puglia',
    # Basilicata
    'MT': 'Basilicata', 'PZ': 'Basilicata',
    # Calabria
    'CZ': 'Calabria', 'CS': 'Calabria', 'KR': 'Calabria', 'RC': 'Calabria', 'VV': 'Calabria',
    # Sicilia
    'AG': 'Sicilia', 'CL': 'Sicilia', 'CT': 'Sicilia', 'EN': 'Sicilia', 'ME': 'Sicilia',
    'PA': 'Sicilia', 'RG': 'Sicilia', 'SR': 'Sicilia', 'TP': 'Sicilia',
    # Sardegna (incluse le 4 province soppresse/riaccorpate nel 2016)
    'CA': 'Sardegna', 'NU': 'Sardegna', 'OR': 'Sardegna', 'SS': 'Sardegna', 'SU': 'Sardegna',
    'CI': 'Sardegna', 'VS': 'Sardegna', 'OG': 'Sardegna', 'OT': 'Sardegna',
}

REGIONS_20 = sorted(set(PROVINCE_TO_REGION.values()))
assert len(REGIONS_20) == 20, "Attese 20 regioni, trovate %d: %s" % (len(REGIONS_20), REGIONS_20)


def region_for_province_code(code):
    """Ritorna il nome della regione per un codice provincia (es. 'MI' ->
    'Lombardia'), o None se il codice non e' tra quelli mappati -- NON
    inventa una regione per un codice sconosciuto, coerente con la regola
    anti-allucinazione del progetto."""
    return PROVINCE_TO_REGION.get(code)


if __name__ == '__main__':
    print("Regioni coperte (%d):" % len(REGIONS_20))
    for r in REGIONS_20:
        print(" -", r)
    print("\nProvince mappate:", len(PROVINCE_TO_REGION))
