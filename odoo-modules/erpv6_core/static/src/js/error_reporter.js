/* Aggancio globale errori JS (24/08/2026, richiesto esplicitamente da
   Denis: "vorrei che Kaizen scoprisse anche altri problemi... se apro
   una pagina e appare un errore"). Cattura errori reali del client Odoo
   (window.onerror + unhandledrejection, le due sorgenti standard di
   errore JS non gestito) e li manda all'endpoint pubblico dedicato
   (/api/v1/frontend-error) come dato strutturato - mai un log di testo
   libero, coerente col principio gia' seguito da Kaizen lato server.

   Silenzioso su qualunque fallimento dell'invio stesso (mai un secondo
   errore generato dal reporter di errori): un tentativo, nessun retry,
   nessuna coda - un errore isolato perso e' meglio di un ciclo di errori
   sull'errore. */
(function () {
    "use strict";

    var ENDPOINT = "/api/v1/frontend-error";
    var already_sent = new Set();

    function send(payload) {
        var key = (payload.message || "") + "|" + (payload.url || "");
        if (already_sent.has(key)) {
            return; // stesso errore ripetuto nella stessa pagina, non spammare
        }
        already_sent.add(key);
        try {
            fetch(ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                keepalive: true,
            }).catch(function () {});
        } catch (e) {
            // mai propagare un errore dal reporter di errori stesso
        }
    }

    // "blocking" (24/08/2026, richiesto esplicitamente da Denis dopo aver
    // visto un errore reale classificato solo 'near_miss': "un problema che
    // mi blocca l'accesso ad una pagina non e' un near miss"). Segnale
    // STRUTTURATO, non testo interpretato: OwlError e' la classe fissa che
    // il framework Owl stesso usa quando il rendering/lifecycle di un
    // componente fallisce (vedi odoo/addons/web/static/lib/owl/owl.js,
    // "An error occured in the owl lifecycle") - questo tipicamente lascia
    // l'intera vista/azione non renderizzata, non un errore secondario su
    // una pagina gia' caricata. Controllare .name (la classe dell'errore),
    // mai il testo del messaggio.
    function is_blocking(err) {
        if (!err) {
            return false;
        }
        if (err.name === "OwlError") {
            return true;
        }
        // Fallback sul testo (26/08/2026, bug reale trovato da Denis: 4
        // occorrenze reali su 2 giorni, sempre classificate 'near_miss'
        // nonostante fossero chiaramente OwlError - quando l'errore arriva
        // come Promise non gestita, l'oggetto ricevuto da 'unhandledrejection'
        // ha perso .name === 'OwlError' nel passaggio attraverso la gestione
        // errori interna di Owl/Odoo, ma il messaggio resta questo testo
        // fisso e stabile (owl.js, "An error occured in the owl lifecycle").
        var message = err.message || String(err);
        return message.indexOf("owl lifecycle") !== -1;
    }

    window.addEventListener("error", function (event) {
        send({
            message: event.message || "Errore JS sconosciuto",
            url: window.location.href,
            stack: event.error && event.error.stack ? String(event.error.stack).slice(0, 4000) : "",
            user_agent: navigator.userAgent,
            blocking: is_blocking(event.error),
        });
    });

    window.addEventListener("unhandledrejection", function (event) {
        var reason = event.reason;
        send({
            message: "Promise non gestita: " + (reason && reason.message ? reason.message : String(reason)),
            url: window.location.href,
            stack: reason && reason.stack ? String(reason.stack).slice(0, 4000) : "",
            user_agent: navigator.userAgent,
            blocking: is_blocking(reason),
        });
    });
})();
