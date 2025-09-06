from PIL import Image, ImageEnhance, ImageFilter
import pytesseract
from pdf2image import convert_from_bytes
import numpy as np
import cv2
import re
import easyocr

def extract_certificate_parts(img):
    base_parts = [
        (4830, 350, 4960, 550),  # UC
        (4987, 350, 5300, 550),  # block 1
        (5308, 350, 5475, 550),  # block 2
        (5495, 350, 5647, 550),  # block 3
        (5670, 350, 5833, 550),  # block 4 
        (5850, 350, 6530, 550),  # block 5 
    ]
    dpi = 400
    factor = dpi / 300
    scaled_parts = [scale_coords(b, factor) for b in base_parts]
    parts = []
    for coords in scaled_parts:
        part_img = img.crop(coords)
        # part_img.show()
        # Preprocessing as before...
        gray = part_img.convert('L')
        contrast = ImageEnhance.Contrast(gray).enhance(2.5)
        arr = np.array(contrast)
        _, bw = cv2.threshold(arr, 130, 255, cv2.THRESH_BINARY)
        binarized = Image.fromarray(bw)
        # OCR
        part_text = pytesseract.image_to_string(binarized, config='--psm 7')
        print("Part OCR:", part_text)
        parts.append(part_text.strip().replace('\n', '').replace(' ', '').replace('-', ''))
    cert_number = '-'.join(parts)
    print(f"Combined cert number: {cert_number}")
    return cert_number

# Old method
def extract_certificate_id_easyocr(img):
    print(img.size)
    # Crop certificate number area
    base_crop = (4830, 350, 6530, 550)  # for 300 DPI
    dpi = 400
    factor = dpi / 300
    scaled_crop = scale_coords(base_crop, factor)
    tight_crop = img.crop(scaled_crop)
    tight_crop.show()

    # Upscale for better OCR
    w, h = tight_crop.size
    if w < 1000:
        tight_crop = tight_crop.resize((1000, int(1000 * h / w)), Image.LANCZOS)

    # Preprocess: grayscale, contrast, binarize, sharpen
    gray = tight_crop.convert('L')
    contrast = ImageEnhance.Contrast(gray).enhance(2.5)
    arr = np.array(contrast)
    _, bw = cv2.threshold(arr, 130, 255, cv2.THRESH_BINARY)
    binarized = Image.fromarray(bw).filter(ImageFilter.SHARPEN)
    binarized.save("debug_binarized_easyocr.png")

    # Prepare both normal and inverted images for EasyOCR
    easyocr_images = []
    easyocr_images.append(np.array(binarized.convert("RGB")))
    arr_inv = cv2.bitwise_not(bw)
    binarized_inv = Image.fromarray(arr_inv).filter(ImageFilter.SHARPEN)
    easyocr_images.append(np.array(binarized_inv.convert("RGB")))

    reader = easyocr.Reader(['en'])
    allowlist = "UCabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-"

    # **More tolerant regex: allow last block 10 to 15 chars**
    cert_regex = r'(U?C-[A-Za-z0-9\-]{8,}-[A-Za-z0-9\-]{4,}-[A-Za-z0-9\-]{4,}-[A-Za-z0-9\-]{4,}-[A-Za-z0-9\-]{10,15})'
    all_candidates = []
    raise Exception("Not exist")


def scale_coords(coords, factor):
    return tuple(int(x * factor) for x in coords)


### --- Part 2: General text ocr & field extraction --- ###
def extract_certificate_fields(img, cert_id=None):
    text = pytesseract.image_to_string(img)
    # print("----- OCR OUTPUT -----\n", text, "\n----------------------")
    lines = [line.strip() for line in text.split('\n') if line.strip()]

    # Instructor extraction
    instructor = None
    for i, line in enumerate(lines):
        if 'Instructors' in line or 'Instructor' in line:
            instructor = ' '.join(line.split()[1:])
            if not instructor and i+1 < len(lines):
                instructor = lines[i+1]
            break

    # Course name extraction (usually between certificate title and instructor)
    course_name = ""
    if "CERTIFICATE OF COMPLETION" in text and "Instructors" in text:
        start = text.find("CERTIFICATE OF COMPLETION")
        end = text.find("Instructors")
        block = text[start:end]
        course_lines = [l for l in block.split('\n') if l.strip() and ("[" in l or "&" in l or "Spring" in l)]
        if not course_lines:
            # fallback: take all non-empty lines in block, skip CERTIFICATE OF COMPLETION
            course_lines = [l for l in block.split('\n') if l.strip() and "CERTIFICATE" not in l]
        course_name = ' '.join(course_lines).replace('\n', ' ').strip()

    # Name extraction (find line before "Date" or with likely name format)
    user_name = None
    for i, line in enumerate(lines):
        if re.match(r"^[A-Z][a-z]+ [A-Z][a-z]+$", line):
            if i+1 < len(lines) and ("Date" in lines[i+1] or "Length" in lines[i+1]):
                user_name = line
                break
    if not user_name:
        for line in lines:
            if re.match(r"^[A-Z][a-z]+ [A-Z][a-z]+$", line):
                user_name = line
                break

    result = {
        "Certificate ID": cert_id or "Not found",
        "Instructor": instructor or "Not found",
        "Course Name": course_name or "Not found",
        "User Name & Surname": user_name or "Not found"
    }
    return result


def extract_certificate_from_pdf(file):
    file_bytes = file.read()
    pages = convert_from_bytes(file_bytes, dpi=400)
    if not pages:
        raise ValueError("No pages found in PDF")
    img = pages[0]
    print("Image size at", 400, "DPI:", img.size)

    cert_id = extract_certificate_parts(img)
    if cert_id is None:
        raise Exception("Cert is is None")

    fields = extract_certificate_fields(img, cert_id=cert_id)
    return fields