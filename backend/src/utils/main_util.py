from utils.parser import extract_certificate_from_pdf
from utils.web_scrapper_udemy import scrap_udemy
from dotenv import load_dotenv
import os
load_dotenv()

def verify_certificate(file):
    fields = extract_certificate_from_pdf(file)
    udemy_link = os.getenv("UDEMY_LINK")
    if not udemy_link:
        raise Exception("UDEMY_LINK environment variable is not set.")
    certificate_url = udemy_link + fields["Certificate ID"] + "/"

    username, course_name = scrap_udemy(certificate_url)

    result = {
        "is_verified": (fields["User Name & Surname"] == username and fields["Course Name"] == course_name),
        "fields": fields,
        "udemy_result": {"username": username, "course_name": course_name},
        "certificate_url": certificate_url
    }
    return result
