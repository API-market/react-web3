const React = require('react');
const PropTypes = require('prop-types');
const isEmpty = require('lodash/isEmpty');
const AccountUnavailable = require('./AccountUnavailable');
const Web3Unavailable = require('./Web3Unavailable');

const ONE_SECOND = 1000;
const ONE_MINUTE = ONE_SECOND * 60;
const propTypes = {
  web3UnavailableScreen: PropTypes.any,
  accountUnavailableScreen: PropTypes.any,
  onChangeAccount: PropTypes.func
};
const defaultProps = {
  passive: false,
  web3UnavailableScreen: Web3Unavailable,
  accountUnavailableScreen: AccountUnavailable
};
const childContextTypes = {
  web3: PropTypes.shape({
    accounts: PropTypes.array,
    selectedAccount: PropTypes.string,
    network: PropTypes.string,
    networkId: PropTypes.string
  })
};

class Web3Provider extends React.Component {

  static contextTypes = {
    store: PropTypes.object
  };

  constructor(props, context) {
    super(props, context);
    const accounts = this.getAccounts();

    this.state = {
      accounts,
      networkId: null,
      networkError: null
    };

    if (!isEmpty(accounts)) {
      this.fetchAccountBalance(accounts[0]);
    }

    this.interval = null;
    this.networkInterval = null;
    this.fetchAccounts = this.fetchAccounts.bind(this);
    this.fetchNetwork = this.fetchNetwork.bind(this);
    this.fetchAccountBalance = this.fetchAccountBalance.bind(this);
    this.appState = props.appState;

    if (accounts) {
      this.handleAccounts(accounts, true);
    }
  }

  getChildContext() {
    //this.appState.accounts = this.state.accounts;
    this.appState.selectedAccount = this.state.accounts && this.state.accounts[0];
    this.network = getNetwork(this.state.networkId);
    this.networkId = this.state.networkId;

    return {
      web3: this.appState
    };
  }

  /**
   * Start polling accounts, & network. We poll indefinitely so that we can
   * react to the user changing accounts or netowrks.
   */
  componentDidMount() {
    this.fetchAccounts();
    this.fetchNetwork();
    this.initPoll();
    this.initNetworkPoll();
  }

  /**
   * Init web3/account polling, and prevent duplicate interval.
   * @return {void}
   */
  initPoll() {
    if (!this.interval) {
      this.interval = setInterval(this.fetchAccounts, ONE_SECOND);
    }
  }

  /**
   * Init network polling, and prevent duplicate intervals.
   * @return {void}
   */
  initNetworkPoll() {
    if (!this.networkInterval) {
      this.networkInterval = setInterval(this.fetchNetwork, ONE_MINUTE);
    }
  }

  /**
   * Update state regarding the availability of web3 and an ETH account.
   * @return {void}
   */
  fetchAccounts() {
    const { web3 } = window;
    const ethAccounts = this.getAccounts();

    if (isEmpty(ethAccounts)) {
      web3 && web3.eth && web3.eth.getAccounts((err, accounts) => {
        if (err) {
          this.setState({
            accountsError: err
          });
        } else {
          this.handleAccounts(accounts);
        }
      });
    } else {
      this.handleAccounts(ethAccounts);
    }
  }

  fetchAccountBalance(address) {
    const { web3 } = window;
    web3 && web3.eth && web3.eth.getBalance(address, (err, balance) => {
      if (err) {
        console.error(err);
      } else {
        this.setAccountBalance(web3.fromWei(balance.toNumber()));
      }
    });
  }

  setAccountBalance(balance) {
    this.appState.selectedAccountBalance = balance;
  }

  handleAccounts(accounts, isConstructor = false) {
    const { onChangeAccount } = this.props;
    const { store } = this.context;
    let next = accounts[0];
    let curr = this.state.accounts[0];
    next = next && next.toLowerCase();
    curr = curr && curr.toLowerCase();
    const didChange = curr && next && (curr !== next);

    if (isEmpty(this.state.accounts) && !isEmpty(accounts)) {
      this.setState({
        accountsError: null,
        accounts: accounts
      });

      this.fetchAccountBalance(next);
    }

    // If provided, execute callback
    if (didChange) {
      if (!isConstructor) {
        this.setState({
          accountsError: null,
          accounts
        });

        this.fetchAccountBalance(next);
      }

      if (typeof onChangeAccount === 'function') {
        onChangeAccount(next);
      }
    }

    // If available, dispatch redux action
    if (store && typeof store.dispatch === 'function') {
      const didDefine = !curr && next;

      if (didDefine || (isConstructor && next)) {
        store.dispatch({
          type: 'web3/RECEIVE_ACCOUNT',
          address: next
        });
      } else if (didChange) {
        store.dispatch({
          type: 'web3/CHANGE_ACCOUNT',
          address: next
        });
      }
    }
  }

  /**
   * Get the network and update state accordingly.
   * @return {void}
   */
  fetchNetwork() {
    const { web3 } = window;

    web3 && web3.version && web3.version.getNetwork((err, netId) => {
      if (err) {
        this.setState({
          networkError: err
        });
      } else {
        if (netId != this.state.networkId) {
          this.setState({
            networkError: null,
            networkId: netId
          });
        }
      }
    });
  }

  /**
   * Get the account. We wrap in try/catch because reading `web3.eth.accounrs`
   * will throw if no account is selected.
   * @return {String}
   */
  getAccounts() {
    try {
      const { web3 } = window;
      // throws if no account selected
      const accounts = web3.eth.accounts;

      return accounts;
    } catch (e) {
      return [];
    }
  }

  render() {
    const { web3 } = window;
    const {
      passive,
      web3UnavailableScreen: Web3UnavailableComponent,
      accountUnavailableScreen: AccountUnavailableComponent
    } = this.props;

    if (passive) {
      return this.props.children;
    }

    if (!web3) {
      return <Web3UnavailableComponent />;
    }

    if (isEmpty(this.state.accounts)) {
      return <AccountUnavailableComponent />;
    }

    return this.props.children;
  }
}

Web3Provider.propTypes = propTypes;
Web3Provider.defaultProps = defaultProps;
Web3Provider.childContextTypes = childContextTypes;

module.exports = Web3Provider;

/* =============================================================================
=    Deps
============================================================================= */
function getNetwork(networkId) {
  switch (networkId) {
    case '1':
      return 'MAINNET';
    case '2':
      return 'MORDEN';
    case '3':
      return 'ROPSTEN';
    case '4':
      return 'RINKEBY';
    case '42':
      return 'KOVAN';
    default:
      return 'UNKNOWN';
  }
}
