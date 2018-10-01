Array.prototype.insert = function ( index, item ) {
  this.splice( index, 0, item );
};

new Vue({
  el: '#app',
  data() {
    return {
      account: {
        name: '',
        active: '',
        owner: ''
      },
      userConfirmation: false,
      q: "",
      scatter: null,
      msg: null,
      identity: null,
      tx: null,
      eos: null,
      eosOptions: {
        httpEndpoint: 'https://publicapi-mainnet.eosauthority.com',
        verbose: false,
      },
      eosAccount: null,
      eosError: null,
      eup: {},
      network: {
        name: "EOS Mainnet",
        protocol: 'https',
        blockchain: 'eos',
        host: 'publicapi-mainnet.eosauthority.com',
        port: 443,
        chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906'
      }
    }
  },  
  mounted() {
    document.addEventListener('scatterLoaded', scatterExtension => {
      const scatter = window.scatter;
      window.scatter = null;
      scatter.requireVersion(3.0);
      this.scatter = scatter
      this.forgetIdentity()    
    })
    this.eos = EosApi(this.eosOptions)
  },
  methods: {
    getPermission: function(perm) {
      return this.eosAccount.permissions.find(p => p.perm_name === perm)
    },
    isKey: function(str) {
      if (str.startsWith('EOS') && str.length === 53) {
        return true
      }
      return false
    },
    search: function() {
      const self = this
      self.eosAccount = null      
      self.eos.getAccount(self.q)
      .then(res => {
        self.eosAccount = res
      })
      .catch(err => {
        self.eosError = err
      })
    },
    useKey: function(key, index) {
      Vue.set(this.eosUpdatedPerms[index], "key", key)
    },       
    reset: function() {
      this.msg = null
      this.tx = null      
    },
    suggestNetwork: function () {
      this.reset()
      if (this.scatter) {
        var self = this
        this.scatter.suggestNetwork(this.network).then(function (res) {
          console.log(res)
        }).catch(function (err) {
          self.msg = err
        })
      }
    },
    connectScatter: function () {
      this.reset()
      this.eosUpdatedPerms = [] 
      if (this.scatter) {
        var options = {
          accounts: [this.network]
        }
        var self = this
        this.scatter.getIdentity(options)
          .then(function (identity) {
            identity.accounts.forEach((p) => {
              self.q = p.name
              if (self.account.name  === '') {
                self.account.name = p.name
              }
              self.eup = {
                key: null,
                authority: p.authority,
                account: p.name,
              }
            })
            self.search()    
            self.identity = identity
          })
          .catch(function (err) {
            self.msg = err
          })
      } else {
        this.msg = {
          type: 'Sorry',
          message: 'We are unable to locate the scatter plugin!',
          isError: true
        }
      }
    },
    forgetIdentity: function() {
      this.reset()
      this.identity = null
      if (this.scatter) {
        const self = this
        this.scatter.forgetIdentity().then(function(r){
          console.log()
        }).catch(function(err) {
          self.msg = err
        })
      }
    },
    prepareOpts: function(account, owner, accountOrKey, perm) {
      const opts = {
        account: account,
        permission: perm,
        parent: owner,
        auth:{
          threshold: 1,
          accounts: [],
          keys: []
        }
      }
      if (this.isKey(accountOrKey)) {
        opts.auth.keys.push({
          key: accountOrKey,
          weight: 1
        })
      } else if(accountOrKey.length === 12) {
        opts.auth.accounts.push({
          permission:{
            actor: accountOrKey,
            permission: 'active'
          },
          weight: 1
        })
      } else {
        return null
      }
      return opts
    },
    updateAccountKey: function () {
      this.reset()
      const self = this
      if (self.scatter) {
        const eos = self.scatter.eos(self.network, Eos, {
          chainId: self.network.chainId
        })        
        const account = self.account.name
        const opts = [
          self.prepareOpts(account, '', self.account.owner, 'owner'),
          self.prepareOpts(account, 'owner', self.account.active, 'active')
        ]
        eos.transaction(function(tx){
          opts.forEach(function(opt){
            if(opt !== null){
              tx.updateauth(opt, {authorization: `${self.eup.account}@${self.eup.authority}`})
            }
          })
        })
        .then(r => {
          self.tx = r
          self.account = {
            name: '',
            active: '',
            owner: ''
          }
          self.eosAccount = null
          self.userConfirmation = false
        }).catch(err => {
          self.msg = {
            type: err.name ? err.name : err.type,
            message: err.what? err.what: err.message,
            isError: true
          }
        })
      }
    }
  }
})