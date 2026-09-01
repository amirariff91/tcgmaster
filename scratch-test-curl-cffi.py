from curl_cffi import requests

url = "https://www.pricecharting.com/game/one-piece-japanese-romance-dawn/shanks-alternate-art-manga-op01-120"
print(f"Testing CF bypass on URL: {url}")

try:
    response = requests.get(url, impersonate="chrome120")
    if "hoverable-striped" in response.text or "shanks" in response.text.lower():
        if "Just a moment" in response.text:
            print("FAILED! Blocked by Cloudflare (Just a moment...)")
        else:
            print("SUCCESS! Bypassed Cloudflare with curl_cffi!")
    else:
        print("Unknown response. Length:", len(response.text))
except Exception as e:
    print("Error:", e)
