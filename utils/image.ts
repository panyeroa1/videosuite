// utils/image.ts

export const overlayTextOnImage = (imageUrl: string, text: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return reject(new Error('Could not get canvas context'));
        }

        const img = new Image();
        img.crossOrigin = 'anonymous'; // Important for images from other origins
        img.onload = () => {
            // Set canvas dimensions to match image
            canvas.width = img.width;
            canvas.height = img.height;

            // Draw the base image
            ctx.drawImage(img, 0, 0);

            // --- Text Styling ---
            const fontSize = Math.max(80, Math.floor(canvas.width / 15)); // Responsive font size
            ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Text with thick black outline
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = Math.max(8, fontSize / 10); // Responsive outline
            ctx.fillStyle = '#FFFFFF';
            
            // Drop shadow for depth
            ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;

            // --- Text Wrapping ---
            const maxWidth = canvas.width * 0.9;
            const words = text.toUpperCase().split(' ');
            let line = '';
            const lines = [];
            
            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > maxWidth && n > 0) {
                    lines.push(line);
                    line = words[n] + ' ';
                } else {
                    line = testLine;
                }
            }
            lines.push(line);
            
            // --- Drawing Text ---
            const lineHeight = fontSize * 1.1;
            const startY = (canvas.height - (lines.length - 1) * lineHeight) / 2;

            lines.forEach((line, index) => {
                const y = startY + index * lineHeight;
                ctx.strokeText(line.trim(), canvas.width / 2, y);
                ctx.fillText(line.trim(), canvas.width / 2, y);
            });
            
            // Resolve with the new image data URL
            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = (err) => {
            // This can happen due to CORS issues if the image isn't served correctly
            reject(new Error(`Failed to load image for thumbnail creation. Error: ${err}`));
        };
        img.src = imageUrl;
    });
};
