import { useEffect, useRef } from 'react';
import QRCode from 'qrcode-generator';

const QUIET_ZONE = 4; // required by QR standard

type QRSize = 'small' | 'medium' | 'large';

const SIZES_MAP: Record<QRSize, number> = {
    small: 4,
    medium: 6,
    large: 8,
};

const OfflineQRCode = ({ url, size = 'medium' }: { url: string; size?: QRSize }) => {
    const ref = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const qr = QRCode(0, 'M');
        qr.addData(url);
        qr.make();

        const canvas = ref.current;

        if (!canvas) {
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        const moduleCount = qr.getModuleCount();
        const scale = SIZES_MAP[size] || SIZES_MAP.medium;

        const fullSize = (moduleCount + QUIET_ZONE * 2) * scale;

        canvas.width = fullSize;
        canvas.height = fullSize;

        // background
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, fullSize, fullSize);

        ctx.fillStyle = '#000';

        for (let y = 0; y < moduleCount; y++) {
            for (let x = 0; x < moduleCount; x++) {
                if (qr.isDark(y, x)) {
                    ctx.fillRect((x + QUIET_ZONE) * scale, (y + QUIET_ZONE) * scale, scale, scale);
                }
            }
        }
    }, [url, size]);

    return <canvas ref={ref} />;
};

export default OfflineQRCode;
