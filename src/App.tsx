import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";

const hasErrorCode = (
  error: unknown,
): error is {
  code: number | string;
} => typeof error === "object" && error !== null && "code" in error;

type TxAction =
  | "nativeTransfer"
  | "tokenTransfer"
  | "approve"
  | "deposit"
  | null;

function App() {
  const [account, setAccount] = useState("");
  const [balance, setBalance] = useState("");
  const [chainId, setChainId] = useState("");
  const [chainName, setChainName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const [txAction, setTxAction] = useState<TxAction>(null);
  const [error, setError] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");

  const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ];

  const BANK_ABI = [
    "function deposit(uint256 amount)",
    "function deposits(address user) view returns (uint256)",
    "function getContractTokenBalance() view returns (uint256)",
  ];

  const [tokenBalance, setTokenBalance] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("TOKEN");
  const [tokenDecimals, setTokenDecimals] = useState(18);

  const [spenderAddress, setSpenderAddress] = useState("");
  const [allowanceValue, setAllowanceValue] = useState("");
  const [approveAmount, setApproveAmount] = useState("");

  const [depositAmount, setDepositAmount] = useState("");
  const [userDeposit, setUserDeposit] = useState("");
  const [bankBalance, setBankBalance] = useState("");

  const TOKEN_ADDRESS = "0xfC418b3CbeD2EbBe262180c9b7921B2dA0a26FB8";
  const BANK_ADDRESS = "0x254B9245f2F5b18546Aa085F2b5493ea98Fefe71";

  const formatAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const resetTxFeedback = useCallback(() => {
    setTxAction(null);
    setTxStatus("idle");
    setTxHash("");
  }, []);

  const beginTx = (action: Exclude<TxAction, null>) => {
    setTxAction(action);
    setTxStatus("pending");
    setTxHash("");
  };

  const isTxPending = (action: Exclude<TxAction, null>) =>
    isLoading && txAction === action && txStatus === "pending";

  const renderTxFeedback = (action: Exclude<TxAction, null>) => {
    if (txAction !== action || txStatus === "idle") return null;

    const statusText = {
      pending: "Awaiting confirmation...",
      success: "Transaction confirmed.",
      error: "Transaction failed.",
    }[txStatus];

    const statusColor = {
      pending: "#856404",
      success: "#067647",
      error: "#b42318",
    }[txStatus];

    return (
      <>
        <p style={{ marginTop: 12, color: statusColor }}>{statusText}</p>
        {txHash && (
          <p style={{ marginTop: 12, wordBreak: "break-all" }}>
            <strong>Tx Hash: </strong>
            {txHash}{" "}
            <a
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Etherscan
            </a>
          </p>
        )}
      </>
    );
  };

  const getChainName = (id: string) => {
    const map: Record<string, string> = {
      "0x1": "Ethereum Mainnet",
      "0xaa36a7": "Sepolia",
      "0x89": "Polygon",
      "0x38": "BNB Smart Chain",
    };
    return map[id] ?? `Unknown Network (${id})`;
  };

  const resetState = useCallback(() => {
    setAccount("");
    setBalance("");
    resetTxFeedback();
  }, [resetTxFeedback]);

  const getTokenContract = useCallback((runner: ethers.ContractRunner) => {
    return new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, runner);
  }, []);

  const getBankContract = useCallback((runner: ethers.ContractRunner) => {
    return new ethers.Contract(BANK_ADDRESS, BANK_ABI, runner);
  }, []);

  const loadTokenMeta = useCallback(
    async (provider: ethers.ContractRunner) => {
      try {
        const contract = getTokenContract(provider);
        const [decimals, symbol] = await Promise.all([
          contract.decimals(),
          contract.symbol(),
        ]);

        setTokenDecimals(Number(decimals));
        setTokenSymbol(symbol);
      } catch (err) {
        console.error(err);
        setError("Failed to load token metadata. Please verify the token contract.");
      }
    },
    [getTokenContract],
  );

  const loadTokenBalance = useCallback(
    async (address: string) => {
      const ethereum = window.ethereum;
      if (!ethereum || !address) return;

      try {
        const provider = new ethers.BrowserProvider(ethereum);
        const contract = getTokenContract(provider);
        const tokenBalanceValue = await contract.balanceOf(address);
        setTokenBalance(ethers.formatUnits(tokenBalanceValue, tokenDecimals));
      } catch (err) {
        console.error(err);
        setError("Failed to load token balance.");
      }
    },
    [getTokenContract, tokenDecimals],
  );

  const loadWalletData = useCallback(
    async (selectedAccount: string) => {
      const ethereum = window.ethereum;
      if (!ethereum || !selectedAccount) return;

      try {
        setError("");

        const provider = new ethers.BrowserProvider(ethereum);

        const [balanceWei, network] = await Promise.all([
          provider.getBalance(selectedAccount),
          provider.getNetwork(),
        ]);

        setAccount(selectedAccount);
        setBalance(Number(ethers.formatEther(balanceWei)).toFixed(4));
        setChainId(`0x${network.chainId.toString(16)}`);
        setChainName(getChainName(`0x${network.chainId.toString(16)}`));

        await loadTokenMeta(provider);
      } catch (err) {
        console.error(err);
        setError("Failed to load wallet data. Please try again.");
      }
    },
    [loadTokenMeta],
  );

  const checkIfWalletIsConnected = useCallback(async () => {
    const ethereum = window.ethereum;
    if (!ethereum) return;

    try {
      setError("");
      setIsLoading(true);

      const accounts = (await ethereum.request({
        method: "eth_accounts",
      })) as string[];

      const currentChainId = (await ethereum.request({
        method: "eth_chainId",
      })) as string;

      setChainId(currentChainId);
      setChainName(getChainName(currentChainId));

      if (accounts.length > 0) {
        await loadWalletData(accounts[0]);
      } else {
        resetState();
      }
    } catch (err) {
      console.error(err);
      setError("Failed to detect wallet connection status.");
    } finally {
      setIsLoading(false);
    }
  }, [loadWalletData, resetState]);

  const connectWallet = async () => {
    const ethereum = window.ethereum;
    if (!ethereum) {
      alert("Please install MetaMask first.");
      return;
    }

    if (!isSepolia) {
      setError("Wrong network. Please switch to Sepolia.");
      return;
    }

    try {
      setError("");
      setIsLoading(true);

      const accounts = (await ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      await loadWalletData(accounts[0]);
    } catch (err) {
      console.error(err);
      if (hasErrorCode(err) && err.code === 4001) {
        setError("Wallet connection request was rejected.");
      } else {
        setError("Failed to connect wallet. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const sendTransaction = async () => {
    const ethereum = window.ethereum;
    if (!ethereum) {
      setError("MetaMask is not installed.");
      return;
    }

    if (!isSepolia) {
      setError("Wrong network. Please switch to Sepolia.");
      return;
    }

    setTxAction("nativeTransfer");
    setTxStatus("idle");
    setTxHash("");

    if (!toAddress || !amount) {
      setError("Enter a recipient address and amount.");
      return;
    }

    try {
      setError("");
      setIsLoading(true);
      beginTx("nativeTransfer");

      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();

      const tx = await signer.sendTransaction({
        to: toAddress,
        value: ethers.parseEther(amount),
      });

      setTxHash(tx.hash);
      await tx.wait();

      setTxStatus("success");
      const address = await signer.getAddress();
      await loadWalletData(address);
      await loadTokenBalance(address);
    } catch (err) {
      console.error(err);
      setTxStatus("error");

      if (hasErrorCode(err) && err.code === 4001) {
        setError("Transaction was rejected.");
      } else if (String(err).includes("insufficient funds")) {
        setError("Insufficient balance.");
      } else if (String(err).includes("allowance")) {
        setError("Insufficient allowance.");
      } else {
        setError("Transaction failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const sendToken = async () => {
    const ethereum = window.ethereum;
    if (!ethereum) {
      setError("MetaMask is not installed.");
      return;
    }

    if (!isSepolia) {
      setError("Wrong network. Please switch to Sepolia.");
      return;
    }

    setTxAction("tokenTransfer");
    setTxStatus("idle");
    setTxHash("");

    if (!toAddress || !amount) {
      setError("Enter a recipient address and amount.");
      return;
    }

    try {
      setError("");
      setIsLoading(true);
      beginTx("tokenTransfer");

      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const contract = getTokenContract(signer);

      const tx = await contract.transfer(
        toAddress,
        ethers.parseUnits(amount, 18),
      );

      setTxHash(tx.hash);
      await tx.wait();
      setTxStatus("success");

      const address = await signer.getAddress();
      await loadWalletData(address);
      await loadTokenBalance(address);
    } catch (err) {
      console.error(err);
      setTxStatus("error");

      if (hasErrorCode(err) && err.code === 4001) {
        setError("Transaction was rejected.");
      } else if (String(err).includes("insufficient funds")) {
        setError("Insufficient balance.");
      } else if (String(err).includes("allowance")) {
        setError("Insufficient allowance.");
      } else {
        setError("Transaction failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getAllowance = async () => {
    const ethereum = window.ethereum;
    if (!ethereum) {
      setError("MetaMask is not installed.");
      return;
    }

    if (!isSepolia) {
      setError("Wrong network. Please switch to Sepolia.");
      return;
    }

    if (!account || !spenderAddress) {
      setError("Connect your wallet and enter a spender address.");
      return;
    }

    try {
      setError("");

      const provider = new ethers.BrowserProvider(ethereum);
      const contract = getTokenContract(provider);

      const result = await contract.allowance(account, spenderAddress);
      setAllowanceValue(ethers.formatUnits(result, tokenDecimals));
    } catch (err) {
      console.error(err);
      setError("Failed to load allowance.");
    }
  };

  const approveToken = async () => {
    const ethereum = window.ethereum;
    if (!ethereum) {
      setError("MetaMask is not installed.");
      return;
    }

    if (!isSepolia) {
      setError("Wrong network. Please switch to Sepolia.");
      return;
    }

    setTxAction("approve");
    setTxStatus("idle");
    setTxHash("");

    if (!spenderAddress || !approveAmount) {
      setError("Enter a spender address and approval amount.");
      return;
    }

    try {
      setError("");
      setIsLoading(true);
      beginTx("approve");

      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const contract = getTokenContract(signer);

      const tx = await contract.approve(
        spenderAddress,
        ethers.parseUnits(approveAmount, tokenDecimals),
      );

      setTxHash(tx.hash);
      await tx.wait();
      setTxStatus("success");

      await getAllowance();
      alert(`Approved ${approveAmount} ${tokenSymbol} for spending.`);
    } catch (err) {
      console.error(err);
      setTxStatus("error");

      if (hasErrorCode(err) && err.code === 4001) {
        setError("Approval transaction was rejected.");
      } else {
        setError("Approval failed. Please review the transaction details.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getDepositInfo = async (addr: string) => {
    const ethereum = window.ethereum;
    if (!ethereum) return;

    try {
      const provider = new ethers.BrowserProvider(ethereum);
      const contract = getBankContract(provider);

      const result = await contract.deposits(addr);
      setUserDeposit(ethers.formatUnits(result, tokenDecimals));
    } catch (err) {
      console.error(err);
    }
  };

  const getBankBalance = async () => {
    const ethereum = window.ethereum;
    if (!ethereum) return;

    try {
      const provider = new ethers.BrowserProvider(ethereum);
      const contract = getBankContract(provider);

      const result = await contract.getContractTokenBalance();
      setBankBalance(ethers.formatUnits(result, tokenDecimals));
    } catch (err) {
      console.error(err);
    }
  };

  const depositToken = async () => {
    const ethereum = window.ethereum;
    if (!ethereum) {
      setError("MetaMask is not installed.");
      return;
    }

    if (!isSepolia) {
      setError("Wrong network. Please switch to Sepolia.");
      return;
    }

    setTxAction("deposit");
    setTxStatus("idle");
    setTxHash("");

    if (!depositAmount) {
      setError("Enter an amount to deposit.");
      return;
    }

    if (Number(allowanceValue) < Number(depositAmount)) {
      setError("Allowance too low. Approve tokens before depositing.");
      return;
    }

    try {
      setError("");
      setIsLoading(true);
      beginTx("deposit");

      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const contract = getBankContract(signer);

      const tx = await contract.deposit(
        ethers.parseUnits(depositAmount, tokenDecimals),
      );

      setTxHash(tx.hash);
      await tx.wait();
      setTxStatus("success");

      const address = await signer.getAddress();
      await loadTokenBalance(address);
      await getDepositInfo(address);
      await getBankBalance();
      if (spenderAddress) {
        await getAllowance();
      }
    } catch (err) {
      console.error(err);
      setTxStatus("error");

      if (hasErrorCode(err) && err.code === 4001) {
        setError("Transaction was rejected.");
      } else if (String(err).includes("insufficient funds")) {
        setError("Insufficient balance.");
      } else if (String(err).includes("allowance")) {
        setError("Insufficient allowance.");
      } else {
        setError("Transaction failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setSpenderAddress(BANK_ADDRESS);
  }, []);

  useEffect(() => {
    checkIfWalletIsConnected();
  }, [checkIfWalletIsConnected]);

  useEffect(() => {
    if (!account) return;
    loadTokenBalance(account);
  }, [account, tokenDecimals, loadTokenBalance]);

  useEffect(() => {
    if (!account) return;
    getDepositInfo(account);
    getBankBalance();
  }, [account]);

  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum) return;

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        resetState();
        setError("Wallet disconnected.");
        return;
      }

      setIsLoading(true);
      resetTxFeedback();
      await loadWalletData(accounts[0]);
      setIsLoading(false);
    };

    const handleChainChanged = async (newChainId: string) => {
      setChainId(newChainId);
      setChainName(getChainName(newChainId));

      const accounts = (await ethereum.request({
        method: "eth_accounts",
      })) as string[];

      if (accounts.length > 0) {
        setIsLoading(true);
        resetTxFeedback();
        await loadWalletData(accounts[0]);
        setIsLoading(false);
      }
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener("accountsChanged", handleAccountsChanged);
      ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [loadWalletData, resetState, resetTxFeedback]);

  const isSepolia = chainId.toLowerCase() === "0xaa36a7";

  return (
    <div
      style={{
        maxWidth: "760px",
        margin: "40px auto",
        padding: "32px",
        border: "1px solid #ddd",
        borderRadius: "16px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ marginTop: 0 }}>ERC20 Vault DApp</h1>
      <p>Connect your wallet, approve ERC20 spending, and deposit tokens into a vault.</p>
      <p>Demonstrates a standard DeFi flow: approve -&gt; transferFrom -&gt; deposit.</p>

      {!window.ethereum && (
        <div
          style={{
            padding: "12px 16px",
            background: "#fff3cd",
            color: "#856404",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        >
          MetaMask was not detected in this browser.
        </div>
      )}

      {!isSepolia && account && (
        <div style={{ background: "#fff3cd", padding: 12 }}>
          Switch to Sepolia to continue.
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "#fdecea",
            color: "#b42318",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      <button
        onClick={connectWallet}
        disabled={isLoading || !window.ethereum}
        style={{
          padding: "12px 20px",
          border: "none",
          borderRadius: "10px",
          cursor: isLoading ? "not-allowed" : "pointer",
          fontSize: "16px",
        }}
      >
        {isLoading
          ? "Processing..."
          : account
            ? "Reconnect Wallet"
            : "Connect Wallet"}
      </button>

      <div style={{ marginTop: "24px", lineHeight: 1.8 }}>
        <p>
          <strong>Network:</strong>
          {chainName || "Unavailable"}
        </p>
        <p>
          <strong>Chain ID:</strong>
          {chainId || "Unavailable"}
        </p>
        <p>
          <strong>Sepolia:</strong>
          {chainId ? (isSepolia ? "Connected" : "Not connected") : "Unavailable"}
        </p>
        <p>
          <strong>Wallet:</strong>
          {account ? formatAddress(account) : "Not connected"}
        </p>
        <p>
          <strong>ETH Balance:</strong>
          {balance ? `${balance} ETH` : "Unavailable"}
        </p>
        <p>
          <strong>{tokenSymbol} Balance:</strong>
          {tokenBalance || "Unavailable"}
        </p>
      </div>

      <div style={{ marginTop: 30 }}>
        <h3>Send Assets</h3>

        <input
          placeholder="Recipient address"
          value={toAddress}
          onChange={(e) => setToAddress(e.target.value)}
          style={{
            display: "block",
            marginBottom: 10,
            width: 320,
            padding: 10,
          }}
        />

        <input
          placeholder={`Amount (${tokenSymbol} or ETH)`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{
            display: "block",
            marginBottom: 10,
            width: 320,
            padding: 10,
          }}
        />

        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={sendTransaction}
            disabled={isLoading}
            style={{ padding: "10px 16px" }}
          >
            {isTxPending("nativeTransfer") ? "Processing..." : "Send ETH"}
          </button>

          <button
            onClick={sendToken}
            disabled={isLoading}
            style={{ padding: "10px 16px" }}
          >
            {isTxPending("tokenTransfer")
              ? "Processing..."
              : `Send ${tokenSymbol}`}
          </button>
        </div>

        {renderTxFeedback("nativeTransfer")}
        {renderTxFeedback("tokenTransfer")}
      </div>

      <div style={{ marginTop: 30 }}>
        <h3>Approve Spending</h3>

        <input
          placeholder="Spender address"
          value={spenderAddress}
          onChange={(e) => setSpenderAddress(e.target.value)}
          style={{
            display: "block",
            marginBottom: 10,
            width: 320,
            padding: 10,
          }}
        />

        <input
          placeholder={`Approval amount (${tokenSymbol})`}
          value={approveAmount}
          onChange={(e) => setApproveAmount(e.target.value)}
          style={{
            display: "block",
            marginBottom: 10,
            width: 320,
            padding: 10,
          }}
        />

        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={getAllowance}
            disabled={isLoading}
            style={{ padding: "10px 16px" }}
          >
            Check Allowance
          </button>

          <button
            onClick={approveToken}
            disabled={
              isLoading || !account || !approveAmount || !spenderAddress
            }
            style={{ padding: "10px 16px" }}
          >
            {isTxPending("approve") ? "Processing..." : `Approve ${tokenSymbol}`}
          </button>
        </div>

        {renderTxFeedback("approve")}

        <p style={{ marginTop: 12 }}>
          <strong>Current Allowance:</strong>
          {allowanceValue || "Not loaded"}
        </p>
      </div>

      <div style={{ marginTop: 30 }}>
        <h3>Deposit to TokenBank</h3>

        <input
          placeholder="Deposit amount"
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
          style={{
            display: "block",
            marginBottom: 10,
            width: 320,
            padding: 10,
          }}
        />

        <button
          onClick={depositToken}
          disabled={isLoading || !account || !depositAmount || !isSepolia}
          style={{ padding: "10px 16px" }}
        >
          {isTxPending("deposit") ? "Processing..." : "Deposit Tokens"}
        </button>

        {renderTxFeedback("deposit")}

        <p style={{ marginTop: 12 }}>
          <strong>My Deposit:</strong>
          {userDeposit || "0"}
        </p>

        <p>
          <strong>Vault Balance:</strong>
          {bankBalance || "0"}
        </p>
      </div>
    </div>
  );
}

export default App;
