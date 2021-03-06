App = {
  web3Provider: null,
  contracts: {},
  account: '0x0',

  init: async function() {
    return await App.initWeb3();
  },

  initWeb3: async function() {
    // Modern dapp browsers...
    if (window.ethereum) {
      App.web3Provider = window.ethereum;
      try {
        // Request account access
        await window.ethereum.enable();
      } catch (error) {
        // User denied account access...
        console.error("User denied account access")
      }
    }
    // Legacy dapp browsers...
    else if (window.web3) {
      App.web3Provider = window.web3.currentProvider;
    }
    // If no injected web3 instance is detected, fall back to Ganache
    else {
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
    }
    web3 = new Web3(App.web3Provider);

    return App.initContract();
  },

  initContract: function() {
    $.getJSON('MemeMarket.json', function(data) {
      var memeMarketArtifact = data;
      App.contracts.MemeMarket = TruffleContract(memeMarketArtifact);
      App.contracts.MemeMarket.setProvider(App.web3Provider);

      web3.eth.getCoinbase(function(err, account) {
        if (err === null) {
          App.account = account;
          console.log('Account: ' + App.account);
        }
      });

      App.refreshBalance();
      // Load memes if on voting page
      // Kind of a messy solution but works for now
      if (window.location.pathname === '/HomePage.html') {
        return App.loadTrendData();
      } else if (window.location.pathname === '/VotePage.html') {
        return App.loadVotingOptions();
      } else if (window.location.pathname === '/MarketPage.html') {
        return App.loadAssets();
      }
    });
  },

  refreshBalance: async function() {
    try {
      const instance = await App.contracts.MemeMarket.deployed();
      const balance = await instance.balances.call(App.account);
      console.log(web3.fromWei(balance, 'ether').toString());
      $('#balance').text('Balance: ' + web3.fromWei(balance, 'ether').toString() + 'M3M');
    } catch(err) {
      console.warn(err);
    }
  },

  loadTrendData: async function() {
    try {
      const instance = await App.contracts.MemeMarket.deployed();
      const memesLength = await instance.memesLength.call();
      const memes = [];
      trendData = [];
      for (let i = 0; i < memesLength; i++) {
        const meme = await instance.memes.call(i);
        meme.push(i);
        memes.push(meme);
      }
      memes.sort((a, b) => parseInt(a[3].toString()) > parseInt(b[3].toString()));
      console.log(memes);

      for (let i = Math.min(memesLength, 10) - 1; i >= 0; i--) {
        const meme = memes[i];
        const priceHistory = await instance.priceHistory.call(meme[5])
        const data = [];
        let j = 0;
        for (const price of priceHistory) {
          data.push({ x: j, y : price });
          j++;
        }
        trendData.push({
          name: meme[1],
          link: meme[2],
          description: web3.fromWei(Math.floor(meme[3].toString() / 100), 'ether') + 'ETH per share',
          stats: '',
          id: 'trend' + i,
          data: data
        });
      }

      loadTrendingPage();
    } catch(err) {
      console.warn(err);
    }
  },

  loadAssets: async function() {
    try {
      const instance = await App.contracts.MemeMarket.deployed();

      // Load own meme shares
      userAssets = [];
      const ownedShares = await instance.ownedShares.call({from: App.account});
      let i = 0;
      for (const idx of ownedShares) {
        meme = await instance.memes.call(idx.toString());
        amountStaked = await instance.amountStaked.call(idx.toString());
        userAssets.push({
          idx: idx.toString(),
          name: meme[1],
          link: meme[2],
          amount: amountStaked,
          price: web3.fromWei(Math.floor(meme[3].toString() / 100), 'ether'),
          id: 'sell' + i
        });
        i++;
      }
      loadSellAssets();

      // Load shares for sale
      storeAssets = [];
      const memesLength = await instance.memesLength.call();
      i = 0
      for (let j = 0; j < memesLength; j++) {
        const meme = await instance.memes.call(j);
        if (meme[4].toString() == "0") continue;
        storeAssets.push({
          idx: j,
          name: meme[1],
          link: meme[2],
          amount: meme[4],
          price: web3.fromWei(Math.floor(meme[3].toString() / 100), 'ether'),
          id: 'buy' + i
        });
        i++;
      }
      loadBuyAssets();

    } catch(err) {
      console.warn(err);
    }
  },


  loadVotingOptions: async function() {
    try {
      const instance = await App.contracts.MemeMarket.deployed();
      await instance.getVotingOptions({from: App.account});
      const memeurls = await instance.getVotingOptions.call({from: App.account});
      for (var i = 0; i < 4; i++) {
        $('#meme' + i).attr('src', memeurls[i]);
        voteData[i].link = memeurls[i];
      }
      document.getElementById("voteTable").innerHTML = getHTMLTableString(voteData);
      refreshSelection();
    } catch(err) {
      console.warn(err);
    }
  },

  handleUploadMeme: async function() {
    console.log('Submit clicked');
    const memeurl = $('#memeurl').val();
    const memename = $('#memename').val();
    if (memeurl.substr(0, 8) != "https://") {
      window.alert("Sorry, please enter a link with https://")
      return;
    }

    try {
      const instance = await App.contracts.MemeMarket.deployed();
      await instance.uploadMeme(memename, memeurl, {from: App.account});
      await App.refreshBalance();
      $('#memeurl').val('');
      $('#memename').val('');
      window.alert("Your meme has been submitted!")
    } catch(err) {
      console.warn(err);
    }
  },

  handleVote: async function(num) {
    console.log('Voted for meme #' + num);

    try {
      const instance = await App.contracts.MemeMarket.deployed();
      await instance.vote(num, {from: App.account});
      await App.refreshBalance();
      await App.loadVotingOptions();
    } catch(err) {
      console.warn(err);
    }
  },

  handleSell: async function(num) {
    const amount = $('#input' + num).val();
    console.log('Sold ' + amount + ' shares of meme #' + num);

    try {
      const instance = await App.contracts.MemeMarket.deployed();
      await instance.sellShares(userAssets[num].idx, amount, {from: App.account});
      await App.refreshBalance();
      await App.loadAssets();
    } catch(err) {
      console.warn(err);
    }
  },

  handleBuy: async function(num) {
    console.log(num);
    const amount = $('#input' + num).val();
    console.log('Bought ' + amount + ' shares of meme #' + num);

    try {
      const instance = await App.contracts.MemeMarket.deployed();
      await instance.buyShares(storeAssets[num].idx, amount, {from: App.account});
      await App.refreshBalance();
      await App.loadAssets();
    } catch(err) {
      console.warn(err);
    }
  },

  handleUploadETH: async function() {
    var amount = parseFloat($('#eth_id').val());

    try {
      const instance = await App.contracts.MemeMarket.deployed();
      await instance.deposit({from: App.account, value: web3.toWei(amount, 'ether') });
      await App.refreshBalance();
    } catch(err) {
      console.warn(err);
    }
  },

  handleCashOutETH: async function() {
    var amount = $('#m3m_id').val();

    try {
      const instance = await App.contracts.MemeMarket.deployed();
      await instance.withdraw(web3.toWei(amount, 'ether'), {from: App.account});
      await App.refreshBalance();
    } catch(err) {
      console.warn(err);
    }
  }
};

$(function() {
  $(window).load(function() {
    App.init();
  });
});
