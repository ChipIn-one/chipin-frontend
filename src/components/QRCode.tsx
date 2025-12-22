import Image from 'basics/Image';

const QRCode = ({ url, size = 200 }: { url: string; size?: number }) => (
    <Image
        src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
            url,
        )}`}
        alt="QR code"
    />
);

export default QRCode;
