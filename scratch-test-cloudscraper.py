import cloudscraper

scraper = cloudscraper.create_scraper()
url = "https://www.pricecharting.com/game/one-piece-japanese-romance-dawn/shanks-alternate-art-manga-op01-120"
print(f"Testing CF bypass on URL: {url}")

try:
    response = scraper.get(url)
    if "hoverable-striped" in response.text or "shanks" in response.text.lower():
        if "Just a moment" in response.text:
            print("FAILED! Blocked by Cloudflare (Just a moment...)")
        else:
            print("SUCCESS! Bypassed Cloudflare with cloudscraper!")
    else:
        print("Unknown response. Length:", len(response.text))
except Exception as e:
    print("Error:", e)
