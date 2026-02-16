from PIL import Image, ImageEnhance, ImageOps
import colorsys

def process_logo():
    # Load original image (we will use the one we generated earlier or the one effectively in use)
    # The path is explicit from previous context
    input_path = "assets/img/scriptflow-logo.png"
    
    print(f"Processing {input_path}...")
    img = Image.open(input_path).convert("RGBA")
    
    # 1. Create PURPLE version (Hue Shift)
    # ------------------------------------
    # Convert to HSV to shift hue
    # Pillow doesn't have direct HSV edit for whole image easily, so we iterate or use matrix.
    # Simpler: Split channels, apply logic, or iterate pixels. Iterating 4k image is slow but fine for one-off.
    
    # Let's use a faster matrix approach if possible, or just pixel data access.
    pixels = img.load()
    width, height = img.size
    
    # Create images for Dark and Light mode
    img_dark = Image.new("RGBA", (width, height), (0,0,0,0))
    pixels_dark = img_dark.load()
    
    img_light = Image.new("RGBA", (width, height), (0,0,0,0))
    pixels_light = img_light.load()

    # We want to shift Blue (approx 210-240) to Purple (approx 270-290)
    # Hue shift amount: +50 degrees (approx 0.14 on 0-1 scale)
    hue_shift = 0.14
    
    print("Converting pixels with improved transparency...")
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            
            # --- 1. Hue Shift (Blue -> Purple) ---
            h, s, v = colorsys.rgb_to_hsv(r/255.0, g/255.0, b/255.0)
            
            # Apply shift only if it has enough color saturation
            if s > 0.1:
                h = (h + hue_shift) % 1.0
            
            # --- 2. Improved Transparency Logic ---
            # Aggressive Black Point: 15-18% brightness. 
            # Anything darker than this is DELETED (Alpha 0).
            black_point = 0.18 
            
            if v <= black_point:
                # Fully transparent
                alpha = 0
            else:
                # Map [0.18, 1.0] -> [0.0, 1.0]
                normalized_v = (v - black_point) / (1.0 - black_point)
                
                # Sharp Alpha Curve: 
                # Using power of 1.5 or 2.0 makes semitransparent things fade faster.
                # This ensures we don't have "faint smoke" where there should be "clear black".
                alpha = pow(normalized_v, 1.5)
            
            new_r, new_g, new_b = colorsys.hsv_to_rgb(h, s, v)
            new_r, new_g, new_b = int(new_r*255), int(new_g*255), int(new_b*255)
            new_a = int(alpha * 255)
            
            # --- 3. Dark Mode Output ---
            pixels_dark[x, y] = (new_r, new_g, new_b, new_a)
            
            # --- 4. Light Mode Output ---
            # Same logic for text inversion and contrast boosting
            lm_r, lm_g, lm_b = new_r, new_g, new_b
            lm_a = new_a
            
            # Detect Text (White/High Value, Low Saturation)
            if v > 0.8 and s < 0.2:
                lm_r, lm_g, lm_b = 40, 40, 40 # Dark Grey for text
                lm_a = 255
            
            # Detect Neon (High Saturation) -> Deepen for visibility on white
            elif s > 0.25 and new_a > 10:
                # Deepen Value for contrast (User said 0.7 was too dark, trying 0.95)
                # nearly original brightness
                lm_v_deep = v * 0.95
                lr, lg, lb = colorsys.hsv_to_rgb(h, s, lm_v_deep)
                lm_r, lm_g, lm_b = int(lr*255), int(lg*255), int(lb*255)
                # Reduced Glow 2.0: Tighten the alpha curve.
                # Power > 1.0 makes faint things fainter.
                lm_a = int(pow(new_a/255.0, 1.3) * 255)

            pixels_light[x, y] = (lm_r, lm_g, lm_b, lm_a)

    # --- 5. Cropping (Vertical/Horizontal Trim) ---
    print("Auto-cropping images...")
    # Get bounding box of non-zero alpha
    bbox_dark = img_dark.getbbox()
    bbox_light = img_light.getbbox()
    
    # Use the union of both bounding boxes to keep them aligned if they differ slightly, 
    # or just crop individually. Individually is fine for logos.
    if bbox_dark:
        img_dark = img_dark.crop(bbox_dark)
    if bbox_light:
        img_light = img_light.crop(bbox_light)

    # Save
    print(f"Saving refined logo-dark.png (Size: {img_dark.size})...")
    img_dark.save("assets/img/logo-dark.png")
    
    print(f"Saving refined logo-light.png (Size: {img_light.size})...")
    img_light.save("assets/img/logo-light.png")
    print("Done.")

if __name__ == "__main__":
    process_logo()
