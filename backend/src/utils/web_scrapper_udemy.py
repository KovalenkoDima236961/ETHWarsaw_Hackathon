from seleniumwire import webdriver
from selenium.webdriver.common.by import By
import time

def scrap_udemy(url):
    print(f"url = {url}")
    options = webdriver.ChromeOptions()
    options.add_argument("user-agent=Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument('--headless=new')

    driver = webdriver.Chrome(options=options)

    try:
        driver.get(url)
        time.sleep(5)

        username_elem = driver.find_element(
            By.XPATH, '//*[@data-purpose="certificate-recipient-url"]'
        )
        username = username_elem.text.strip()

        course_name_elem = driver.find_element(
            By.XPATH, '//*[@data-purpose="certificate-course-url"]'
        )
        course_name = course_name_elem.text.strip()

        return (username, course_name)

    except Exception as ex:
        print("Error:", ex)
        return None, None

    finally:
        driver.close()
        driver.quit()