import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";

function App() {
  const [account, setAccount] = useState("");
  const [balance, setBalance] = useState("");
  const [chainId, setChainId] = useState("");
  const [chainName, setChainName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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

  // 0x49E1eA0Ac248EDED371043389d32580c2b9D12f3
  // 0xfC418b3CbeD2EbBe262180c9b7921B2dA0a26FB8
  const TOKEN_ADDRESS = "0xfC418b3CbeD2EbBe262180c9b7921B2dA0a26FB8";

  const BANK_ADDRESS = "0x254B9245f2F5b18546Aa085F2b5493ea98Fefe71";

  const getChainName = (id) => {
    const map = {
      "0x1": "Ethereum Mainnet",
      "0xaa36a7": "Sepolia",
      "0x89": "Polygon",
      "0x38": "BNB Smart Chain",
    };
    return map[id] || `Unknown Network (${id})`;
  };

  const resetState = useCallback(() => {
    setAccount("");
    setBalance("");
  }, []);

  const getTokenContract = useCallback((runner) => {
    return new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, runner);
  }, []);

  const getBankContract = useCallback((runner) => {
    return new ethers.Contract(BANK_ADDRESS, BANK_ABI, runner);
  }, []);

  const loadTokenMeta = useCallback(
    async (provider) => {
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
        setError("读取 Token 信息失败，请检查合约地址。");
      }
    },
    [getTokenContract],
  );

  const loadTokenBalance = useCallback(
    async (address) => {
      if (!window.ethereum || !address) return;

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = getTokenContract(provider);
        const balance = await contract.balanceOf(address);
        setTokenBalance(ethers.formatUnits(balance, tokenDecimals));
      } catch (err) {
        console.error(err);
        setError("读取 Token 余额失败。");
      }
    },
    [getTokenContract, tokenDecimals],
  );

  const loadWalletData = useCallback(
    async (selectedAccount) => {
      if (!window.ethereum || !selectedAccount) return;

      try {
        setError("");

        const provider = new ethers.BrowserProvider(window.ethereum);

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
        setError("读取钱包信息失败，请稍后重试。");
      }
    },
    [loadTokenMeta],
  );

  const checkIfWalletIsConnected = useCallback(async () => {
    if (!window.ethereum) return;

    try {
      setError("");
      setIsLoading(true);

      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });

      const currentChainId = await window.ethereum.request({
        method: "eth_chainId",
      });

      setChainId(currentChainId);
      setChainName(getChainName(currentChainId));

      if (accounts.length > 0) {
        await loadWalletData(accounts[0]);
      } else {
        resetState();
      }
    } catch (err) {
      console.error(err);
      setError("检测钱包连接状态失败。");
    } finally {
      setIsLoading(false);
    }
  }, [loadWalletData, resetState]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("请先安装 MetaMask");
      return;
    }

    try {
      setError("");
      setIsLoading(true);

      // 请求连接钱包
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      await loadWalletData(accounts[0]);
    } catch (err) {
      console.error(err);
      if (err.code === 4001) {
        setError("你取消了钱包连接请求。");
      } else {
        setError("连接钱包失败，请稍后重试。");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const sendTransaction = async () => {
    if (!window.ethereum) {
      setError("请先安装 MetaMask");
      return;
    }

    if (!toAddress || !amount) {
      setError("请输入地址和金额");
      return;
    }

    try {
      setError("");
      setIsLoading(true);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // 构造交易
      const tx = await signer.sendTransaction({
        to: toAddress,
        value: ethers.parseEther(amount),
      });

      console.log("tx:", tx);

      // 拿到交易 hash
      setTxHash(tx.hash);

      // 等待链确认
      await tx.wait();

      alert("交易成功！");

      // 更新余额
      const address = await signer.getAddress();
      await loadWalletData(address);
      await loadTokenBalance(address);
    } catch (err) {
      console.error(err);

      if (err.code === 4001) {
        setError("用户拒绝交易");
      } else {
        setError("交易失败，请检查余额或参数");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const sendToken = async () => {
    if (!window.ethereum) {
      setError("请先安装 MetaMask");
      return;
    }

    if (!toAddress || !amount) {
      setError("请输入地址和金额");
      return;
    }
    try {
      setError("");
      setIsLoading(true);
      setTxHash("");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const contract = getTokenContract(signer);

      const tx = await contract.transfer(
        toAddress,
        ethers.parseUnits(amount, 18),
      );

      setTxHash(tx.hash);

      await tx.wait();

      alert(`${tokenSymbol} 转账成功！`);
      const address = await signer.getAddress();
      await loadWalletData(address);
      await loadTokenBalance(address);
    } catch (err) {
      console.error(err);
      if (err.code === 4001) {
        setError("用户拒绝 Token 交易");
      } else {
        setError("Token 转账失败，请检查地址、余额或合约地址");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 查询 allowance
  const getAllowance = async () => {
    if (!window.ethereum) {
      setError("请先安装 MetaMask");
      return;
    }

    if (!account || !spenderAddress) {
      setError("请先连接钱包并输入 spender 地址");
      return;
    }

    try {
      setError("");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = getTokenContract(provider);

      const result = await contract.allowance(account, spenderAddress);
      setAllowanceValue(ethers.formatUnits(result, tokenDecimals));
    } catch (err) {
      console.error(err);
      setError("读取 allowance 失败");
    }
  };

  // 发起 approve
  const approveToken = async () => {
    if (!window.ethereum) {
      setError("请先安装 MetaMask");
      return;
    }

    if (!spenderAddress || !approveAmount) {
      setError("请输入 spender 地址和授权金额");
      return;
    }

    try {
      setError("");
      setIsLoading(true);
      setTxHash("");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = getTokenContract(signer);

      const tx = await contract.approve(
        spenderAddress,
        ethers.parseUnits(approveAmount, tokenDecimals),
      );

      setTxHash(tx.hash);
      await tx.wait();

      await getAllowance();
      alert(`授权 ${approveAmount} ${tokenSymbol} 成功`);
    } catch (err) {
      console.error(err);

      if (err.code === 4001) {
        setError("用户拒绝授权交易");
      } else {
        setError("授权失败，请检查参数");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getDepositInfo = async (addr) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = getBankContract(provider);

      const result = await contract.deposits(addr);
      setUserDeposit(ethers.formatUnits(result, tokenDecimals));
    } catch (err) {
      console.error(err);
    }
  };

  const getBankBalance = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = getBankContract(provider);

      const result = await contract.getContractTokenBalance();
      setBankBalance(ethers.formatUnits(result, tokenDecimals));
    } catch (err) {
      console.error(err);
    }
  };

  // 存入 deposit
  const depositToken = async () => {
    if (!window.ethereum) {
      setError("请先安装 MetaMask");
      return;
    }

    if (!depositAmount) {
      setError("请输入存入金额");
      return;
    }

    try {
      setError("");
      setIsLoading(true);
      setTxHash("");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const contract = getBankContract(signer);

      const tx = await contract.deposit(
        ethers.parseUnits(depositAmount, tokenDecimals),
      );

      setTxHash(tx.hash);
      await tx.wait();

      alert("存入成功！");

      const address = await signer.getAddress();
      await loadTokenBalance(address);
      await getDepositInfo(address);
      await getBankBalance();
      if(spenderAddress) {
        await getAllowance();
      }
    } catch (err) {
      console.error(err);
      setError("deposit 失败（可能没 approve 或额度不够）");
    } finally {
      setIsLoading(false);
    }
  };
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
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts) => {
      if (accounts.length === 0) {
        resetState();
        setError("钱包已断开连接。");
        return;
      }

      setIsLoading(true);
      await loadWalletData(accounts[0]);
      setIsLoading(false);
    };

    const handleChainChanged = async (newChainId) => {
      setChainId(newChainId);
      setChainName(getChainName(newChainId));

      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });

      if (accounts.length > 0) {
        setIsLoading(true);
        await loadWalletData(accounts[0]);
        setIsLoading(false);
      }
    };
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [loadWalletData, resetState]);

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
      <h1 style={{ marginTop: 0 }}>Web3 Wallet + ERC20 Demo</h1>
      <p>连接钱包、读取 ETH / Token 余额，并发起 ETH / Token 转账。</p>

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
          检测到当前浏览器未安装 MetaMask。
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
        {isLoading ? "处理中..." : account ? "重新连接钱包" : "连接钱包"}
      </button>

      <div style={{ marginTop: "24px", lineHeight: 1.8 }}>
        <p>
          <strong>当前网络：</strong>
          {chainName || "未获取"}
        </p>
        <p>
          <strong>Chain ID：</strong>
          {chainId || "未获取"}
        </p>
        <p>
          <strong>是否为 Sepolia：</strong>
          {chainId ? (isSepolia ? "是" : "否") : "未获取"}
        </p>
        <p>
          <strong>钱包地址：</strong>
          {account || "未连接"}
        </p>
        <p>
          <strong>ETH 余额：</strong>
          {balance ? `${balance} ETH` : "未获取"}
        </p>
        <p>
          <strong>{tokenSymbol} 余额：</strong>
          {tokenBalance || "未获取"}
        </p>
      </div>

      <div style={{ marginTop: 30 }}>
        <h3>发送资产</h3>

        <input
          placeholder="接收地址"
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
          placeholder={`金额 (${tokenSymbol} / ETH)`}
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
            {isLoading ? "处理中..." : "发送 ETH"}
          </button>

          <button
            onClick={sendToken}
            disabled={isLoading}
            style={{ padding: "10px 16px" }}
          >
            {isLoading ? "处理中..." : `发送 ${tokenSymbol}`}
          </button>
        </div>

        {txHash && (
          <p style={{ marginTop: 16, wordBreak: "break-all" }}>
            <strong>交易 Hash：</strong>
            {txHash}
          </p>
        )}
      </div>
      <div style={{ marginTop: 30 }}>
        <h3>Approve 授权</h3>

        <input
          placeholder="Spender 地址"
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
          placeholder={`授权金额 (${tokenSymbol})`}
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
            查询 Allowance
          </button>

          <button
            onClick={approveToken}
            disabled={isLoading}
            style={{ padding: "10px 16px" }}
          >
            {isLoading ? "处理中..." : `授权 ${tokenSymbol}`}
          </button>
        </div>

        <p style={{ marginTop: 12 }}>
          <strong>当前 Allowance：</strong>
          {allowanceValue || "未查询"}
        </p>
      </div>
      <div style={{ marginTop: 30 }}>
        <h3>Token 存入（TokenBank）</h3>

        <input
          placeholder="存入金额"
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
          disabled={isLoading}
          style={{ padding: "10px 16px" }}
        >
          {isLoading ? "处理中..." : "存入 Token"}
        </button>

        <p style={{ marginTop: 12 }}>
          <strong>我的存款：</strong>
          {userDeposit || "0"}
        </p>

        <p>
          <strong>合约总余额：</strong>
          {bankBalance || "0"}
        </p>
      </div>
    </div>
  );
}

export default App;
