from PIL import Image
import numpy as np

def aggressive_background_removal(input_path, output_path):
    """Aggressively remove background from favicon."""
    print(f"Processing {input_path}...")
    
    # Open the image
    img = Image.open(input_path).convert("RGBA")
    data = np.array(img)
    
    # Get RGB and Alpha channels
    rgb = data[:, :, :3].astype(float)
    alpha = data[:, :, 3].copy()
    
    # Calculate brightness for each pixel
    brightness = np.mean(rgb, axis=2)
    
    # Define multiple thresholds for background removal
    # Pure white (255, 255, 255)
    pure_white = np.all(rgb >= 250, axis=2)
    alpha[pure_white] = 0
    
    # Very light gray/white (240-249)
    very_light = np.all(rgb >= 240, axis=2) & ~pure_white
    alpha[very_light] = 0
    
    # Light gray/beige (230-239) - likely background
    light = np.all(rgb >= 230, axis=2) & ~very_light & ~pure_white
    alpha[light] = 0
    
    # Medium light (220-229) - make semi-transparent
    med_light = np.all(rgb >= 220, axis=2) & ~light & ~very_light & ~pure_white
    alpha[med_light] = np.minimum(alpha[med_light], 50)
    
    # Also check for uniform grayish background
    # If R, G, B are all similar (difference < 10) and bright, it's background
    rgb_std = np.std(rgb, axis=2)
    uniform_bright = (rgb_std < 10) & (brightness > 210)
    alpha[uniform_bright] = 0
    
    # Update alpha channel
    data[:, :, 3] = alpha
    
    # Create new image
    result = Image.fromarray(data.astype(np.uint8), mode='RGBA')
    
    # Save
    result.save(output_path)
    print(f"Saved to {output_path}")
    print(f"Removed {np.sum(alpha == 0)} pixels (made transparent)")

if __name__ == "__main__":
    aggressive_background_removal(
        "assets/img/favicon.png",
        "assets/img/favicon.png"
    )
