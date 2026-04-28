// SPDX-License-Identifier: MIT
// TokenFactory Pro — Buy tokens with ETH/BNB; owner withdraws received funds

pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @dev Simple vendor: send ETH, receive tokens at fixed rate. Owner withdraws ETH.
 * After deploy, owner must transfer tokens to this contract so it can sell them.
 */
contract TokenVendor {
    IERC20 public immutable token;
    uint256 public tokensPerEther; // token units (with decimals) per 1 ether
    address public owner;

    event Bought(address indexed buyer, uint256 ethIn, uint256 tokensOut);
    event Withdrawn(address indexed to, uint256 amount);
    event PriceSet(uint256 newTokensPerEther);

    error OnlyOwner();
    error InsufficientTokenBalance();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(address _token, uint256 _tokensPerEther, address _owner) {
        token = IERC20(_token);
        tokensPerEther = _tokensPerEther;
        owner = _owner;
    }

    /// @dev Buy tokens with ETH/BNB. Sends tokens from this contract to msg.sender.
    function buy() external payable {
        if (msg.value == 0) return;
        uint256 amountOut = (msg.value * tokensPerEther) / 1 ether;
        if (token.balanceOf(address(this)) < amountOut) revert InsufficientTokenBalance();
        require(token.transfer(msg.sender, amountOut), "Transfer failed");
        emit Bought(msg.sender, msg.value, amountOut);
    }

    /// @dev Owner withdraws all ETH/BNB received from sales.
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) return;
        (bool ok,) = payable(owner).call{value: balance}("");
        require(ok, "Withdraw failed");
        emit Withdrawn(owner, balance);
    }

    /// @dev Owner can change the price (token units per 1 ether).
    function setPrice(uint256 _tokensPerEther) external onlyOwner {
        tokensPerEther = _tokensPerEther;
        emit PriceSet(_tokensPerEther);
    }

    receive() external payable {
        // Allow receiving ETH so buy() can be called with value
    }
}
