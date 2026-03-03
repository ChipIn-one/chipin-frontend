export const hexToRgba = (hex: string, alpha: number) => {
    const h = hex.replace('#', '');
    const v =
        h.length === 3
            ? h
                  .split('')
                  .map(c => c + c)
                  .join('')
            : h;
    const n = parseInt(v, 16);
    const r = (n >> 16) & 255,
        g = (n >> 8) & 255,
        b = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
