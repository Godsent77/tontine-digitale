const fetch = require('node-fetch');

async function getXofRate() {
  try {
    const res = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asset: 'USDT',
        fiat: 'XOF',
        merchantCheck: true,
        page: 1,
        payTypes: [],
        publisherType: null,
        rows: 10,
        tradeType: 'BUY'
      })
    });
    const data = await res.json();
    if (data.data && data.data.length > 0) {
      const prices = data.data.map(a => parseFloat(a.adv.price));
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      return Math.round(avg * 100) / 100;
    }
  } catch (e) {
    console.log('Binance P2P indisponible, essai CoinGecko...');
  }

  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=xof');
    const data = await res.json();
    if (data.tether && data.tether.xof) return data.tether.xof;
  } catch (e) {
    console.log('CoinGecko indisponible, taux par defaut');
  }

  return 655.957;
}

async function convertToUsdt(amountXof) {
  const rate = await getXofRate();
  const usdtAmount = Math.round((amountXof / rate) * 10000) / 10000;
  return { usdtAmount, rate };
}

module.exports = { getXofRate, convertToUsdt };