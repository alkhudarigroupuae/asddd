// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ShieldedToken
 * @dev A Wrapped ERC20 token that is backed 1:1 by a real token (USDT/USDC).
 * It appears in the receiver's wallet like a normal token.
 * The Owner (Sender) retains control to RELEASE (Unwrap) or REFUND (Clawback).
 * Transfers are disabled to prevent the receiver from moving/hiding the funds before release.
 */

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

contract ShieldedToken {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public owner;
    IERC20 public underlying;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Released(address indexed holder, uint256 amount);
    event Refunded(address indexed holder, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(
        string memory _name, 
        string memory _symbol, 
        address _underlying
    ) {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
        underlying = IERC20(_underlying);
        creationTime = block.timestamp;
        
        // Try to get decimals, default to 18 if fails
        try underlying.decimals() returns (uint8 d) {
            decimals = d;
        } catch {
            decimals = 18;
        }
    }

    /**
     * @dev Deposit Real Token and Mint Shielded Token to recipient.
     */
    function depositAndMint(address to, uint256 amount) external onlyOwner {
        // Ensure the contract has enough allowance from the sender
        // This is the most likely cause of the revert: "transferFrom" fails if not approved.
        // But since this is a new contract, the user must approve THIS contract address first.
        // In our frontend code, we approve the contract address right before calling this.
        // However, if the approval transaction hasn't been mined or confirmed, this will fail.
        require(underlying.transferFrom(msg.sender, address(this), amount), "Transfer failed: Check Allowance");
        _mint(to, amount);
    }

    /**
     * @dev Release: Burn Shielded Token and send Real Token to holder.
     * Use this when the transaction is successful.
     */
    function release(address holder, uint256 amount) external onlyOwner {
        _burn(holder, amount);
        require(underlying.transfer(holder, amount), "Transfer failed");
        emit Released(holder, amount);
    }

    /**
     * @dev Refund: Burn Shielded Token and return Real Token to Owner (Sender).
     * Use this if the transaction is a scam or failed.
     */
    function refund(address holder, uint256 amount) external onlyOwner {
        _burn(holder, amount);
        require(underlying.transfer(owner, amount), "Transfer failed");
        emit Refunded(holder, amount);
    }

    /**
     * @dev Auto-Refund (12 Hours): If the client ignores the agreement, you can pull funds back 
     * without needing to specify the amount, assuming the client didn't agree.
     */
    uint256 public creationTime;
    function autoRefundAfter12Hours(address holder) external onlyOwner {
        require(block.timestamp >= creationTime + 12 hours, "12 hours have not passed");
        uint256 amount = balanceOf[holder];
        _burn(holder, amount);
        require(underlying.transfer(owner, amount), "Transfer failed");
        emit Refunded(holder, amount);
    }

    // Internal Mint
    function _mint(address to, uint256 amount) internal {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    // Internal Burn
    function _burn(address from, uint256 amount) internal {
        require(balanceOf[from] >= amount, "Insufficient balance");
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    // ERC20 Transfer - DISABLED for security (Anti-Scam)
    // Receiver sees the balance but cannot move it until Released.
    function transfer(address to, uint256 amount) external returns (bool) {
        revert("ShieldedToken: Funds are locked until released by sender");
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        revert("ShieldedToken: Funds are locked until released by sender");
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
}
