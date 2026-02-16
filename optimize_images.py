
import os
from pathlib import Path
from PIL import Image

def convert_to_webp(directory):
    path = Path(directory)
    if not path.exists():
        print(f"Directory {directory} does not exist.")
        return

    # Extensions to look for
    extensions = ['*.png', '*.jpg', '*.jpeg']
    images = []
    
    for ext in extensions:
        images.extend(path.glob(ext))

    print(f"Found {len(images)} images to convert in {directory}")

    for img_path in images:
        try:
            # Construct new filename
            new_path = img_path.with_suffix('.webp')
            
            # Skip if already exists
            if new_path.exists():
                print(f"Skipping {img_path.name}, webp version already exists.")
                continue

            print(f"Converting {img_path.name}...")
            
            with Image.open(img_path) as im:
                # Convert to RGB if necessary (e.g. PNG with alpha)
                # However, WebP supports transparency, so usually we can just save.
                # But for safety with some modes:
                if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
                     # Keep transparency
                     pass
                else:
                    im = im.convert('RGB')

                im.save(new_path, 'webp', quality=85, optimize=True)
                
            print(f"Saved {new_path.name}")
            
        except Exception as e:
            print(f"Failed to convert {img_path.name}: {e}")

if __name__ == "__main__":
    assets_dir = "/Users/bricelengama/Documents/Marketing Opti/Cursor/clasp-deployer-web/assets/img"
    convert_to_webp(assets_dir)
