"""Buat ikon PWA persegi (public/icons/) dari lambang burung di public/logo.png.

    pip install pillow && python scripts/buat-ikon-pwa.py

Lambang diambil dari sisi kiri logo.png (di sebelah kiri tulisan "InDeTrack"), ditaruh di tengah kanvas putih.
Ikon "maskable" memakai lambang lebih kecil agar tetap utuh saat Android memotongnya jadi lingkaran/squircle.
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

PUBLIC = Path(__file__).resolve().parent.parent / 'public'
OUT = PUBLIC / 'icons'
MARK_BOX = (0, 0, 395, 361)   # lambang burung pada logo.png (1398 x 361), sebelum tulisan "InDeTrack"
HURUF_I = (352, 118, 395, 361)  # tepi huruf "I" yang ikut terpotong (mulai tepat di bawah paruh burung); dihapus


def ikon(mark, ukuran, isi):
    """Kanvas putih ukuran x ukuran; lambang diperbesar hingga `isi` (0-1) dari sisi kanvas."""
    skala = ukuran * isi / max(mark.size)
    m = mark.resize((round(mark.width * skala), round(mark.height * skala)), Image.LANCZOS)
    kanvas = Image.new('RGBA', (ukuran, ukuran), (255, 255, 255, 255))
    kanvas.alpha_composite(m, ((ukuran - m.width) // 2, (ukuran - m.height) // 2))
    return kanvas.convert('RGB')


def main():
    logo = Image.open(PUBLIC / 'logo.png').convert('RGBA')
    mark = logo.crop(MARK_BOX)
    ImageDraw.Draw(mark).rectangle(HURUF_I, fill=(255, 255, 255, 0))
    putih = Image.new('RGBA', mark.size, (255, 255, 255, 255))
    putih.alpha_composite(mark)
    # pangkas ke batas isi (piksel bukan putih) supaya lambang benar-benar di tengah kanvas
    mark = mark.crop(ImageChops.difference(putih.convert('RGB'), Image.new('RGB', mark.size, (255, 255, 255))).getbbox())
    OUT.mkdir(exist_ok=True)
    for nama, ukuran, isi in [('icon-192.png', 192, 0.78), ('icon-512.png', 512, 0.78),
                              ('icon-maskable-512.png', 512, 0.56), ('apple-touch-icon.png', 180, 0.78)]:
        ikon(mark, ukuran, isi).save(OUT / nama, optimize=True)
        print('dibuat', OUT / nama)


if __name__ == '__main__':
    main()
