async function test() {
  const response = await fetch(`https://tcgrepublic.com/product/text_search.html?q=OP01-120`, {
    headers: {
      'User-Agent': 'curl/8.4.0',
      'Accept': '*/*'
    }
  });
  console.log('Status:', response.status);
}
test();
