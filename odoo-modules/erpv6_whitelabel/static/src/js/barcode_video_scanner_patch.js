/** @odoo-module **/
/* global BarcodeDetector */

import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";
import { browser } from "@web/core/browser/browser";
import { loadJS } from "@web/core/assets";
import { buildZXingBarcodeDetector } from "@web/core/barcode/ZXingBarcodeDetector";
import { onMounted, onWillStart, onWillUnmount, useRef, useState } from "@odoo/owl";
import { BarcodeVideoScanner } from "@web/core/barcode/barcode_video_scanner";

/* Il messaggio "Odoo needs your authorization first." (permesso fotocamera
 * negato) e' una stringa locale dentro la callback di onMounted(), creata
 * all'interno di setup() stesso: non e' un metodo separato patchabile da
 * fuori. setup() e' quindi reimplementato per intero via patch(), identico
 * all'originale (@web/core/barcode/barcode_video_scanner.js) salvo questa
 * stringa. */
patch(BarcodeVideoScanner.prototype, {
    setup() {
        this.videoPreviewRef = useRef("videoPreview");
        this.detectorTimeout = null;
        this.stream = null;
        this.detector = null;
        this.overlayInfo = {};
        this.zoomRatio = 1;
        this.scanPaused = false;
        this.state = useState({
            isReady: false,
        });

        onWillStart(async () => {
            let DetectorClass;
            // Use Barcode Detection API if available.
            // As support is still bleeding edge (mainly Chrome on Android),
            // also provides a fallback using ZXing library.
            if ("BarcodeDetector" in window) {
                DetectorClass = BarcodeDetector;
            } else {
                await loadJS("/web/static/lib/zxing-library/zxing-library.js");
                DetectorClass = buildZXingBarcodeDetector(window.ZXing);
            }
            const formats = await DetectorClass.getSupportedFormats();
            this.detector = new DetectorClass({ formats });
        });

        onMounted(async () => {
            const constraints = {
                video: { facingMode: this.props.facingMode },
                audio: false,
            };

            try {
                this.stream = await browser.navigator.mediaDevices.getUserMedia(constraints);
            } catch (err) {
                const errors = {
                    NotFoundError: _t("No device can be found."),
                    NotAllowedError: _t("ERPV6 needs your authorization first."),
                };
                const errorMessage = _t("Could not start scanning. %(message)s", {
                    message: errors[err.name] || err.message,
                });
                this.props.onError(new Error(errorMessage));
                return;
            }
            if (!this.videoPreviewRef.el) {
                this.cleanStreamAndTimeout();
                const errorMessage = _t("Barcode Video Scanner could not be mounted properly.");
                this.props.onError(new Error(errorMessage));
                return;
            }
            this.videoPreviewRef.el.srcObject = this.stream;
            const ready = await this.isVideoReady();
            if (!ready) {
                return;
            }
            const { height, width } = getComputedStyle(this.videoPreviewRef.el);
            const divWidth = width.slice(0, -2);
            const divHeight = height.slice(0, -2);
            const tracks = this.stream.getVideoTracks();
            if (tracks.length) {
                const [track] = tracks;
                const settings = track.getSettings();
                this.zoomRatio = Math.min(divWidth / settings.width, divHeight / settings.height);
            }
            this.detectorTimeout = setTimeout(this.detectCode.bind(this), 100);
        });

        onWillUnmount(() => this.cleanStreamAndTimeout());
    },
});
