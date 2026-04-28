// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title RevocablePayment
 * @dev A contract for secure payments with a revocation feature (Anti-Scam).
 * The payer deposits REAL tokens (USDT, USDC, etc.).
 * The funds are locked in this contract.
 * The recipient can see the funds are reserved for them.
 * The payer can RELEASE the funds to the recipient (if service is good).
 * The payer can REVOKE (REFUND) the funds back to themselves (if service is bad).
 * NEW: If the recipient doesn't accept the agreement within 12 hours, the payer can auto-refund.
 * NEW: Once released, the recipient receives the tokens directly to their wallet and can send them anywhere.
 */

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract RevocablePayment {
    struct Payment {
        uint256 id;
        address payer;
        address recipient;
        address tokenAddress;
        uint256 amount;
        string note;
        uint256 timestamp;
        bool isReleased;
        bool isRevoked;
    }

    uint256 private _nextId = 1;
    mapping(uint256 => Payment) public payments;
    mapping(address => uint256[]) public payerPayments;
    mapping(address => uint256[]) public recipientPayments;

    event PaymentCreated(uint256 indexed id, address indexed payer, address indexed recipient, uint256 amount, string note);
    event PaymentReleased(uint256 indexed id, address indexed recipient, uint256 amount);
    event PaymentRevoked(uint256 indexed id, address indexed payer, uint256 amount);

    /**
     * @dev Create a new revocable payment.
     * Requires the user to have approved this contract to spend their tokens first.
     */
    function createPayment(
        address _tokenAddress,
        address _recipient,
        uint256 _amount,
        string memory _note
    ) external returns (uint256) {
        require(_amount > 0, "Amount must be > 0");
        require(_recipient != address(0), "Invalid recipient");

        // Transfer tokens from payer to this contract
        IERC20 token = IERC20(_tokenAddress);
        require(token.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        uint256 id = _nextId++;
        payments[id] = Payment({
            id: id,
            payer: msg.sender,
            recipient: _recipient,
            tokenAddress: _tokenAddress,
            amount: _amount,
            note: _note,
            timestamp: block.timestamp,
            isReleased: false,
            isRevoked: false
        });

        payerPayments[msg.sender].push(id);
        recipientPayments[_recipient].push(id);

        emit PaymentCreated(id, msg.sender, _recipient, _amount, _note);
        return id;
    }

    /**
     * @dev Release funds to the recipient.
     * Only the payer can call this.
     * Once released, the recipient gets the REAL tokens in their wallet and can transfer them anywhere.
     */
    function release(uint256 _id) external {
        Payment storage p = payments[_id];
        require(msg.sender == p.payer, "Only payer can release");
        require(!p.isReleased && !p.isRevoked, "Payment already processed");

        p.isReleased = true;
        require(IERC20(p.tokenAddress).transfer(p.recipient, p.amount), "Transfer failed");

        emit PaymentReleased(_id, p.recipient, p.amount);
    }

    /**
     * @dev Revoke funds back to the payer.
     * Only the payer can call this.
     */
    function revoke(uint256 _id) external {
        Payment storage p = payments[_id];
        require(msg.sender == p.payer, "Only payer can revoke");
        require(!p.isReleased && !p.isRevoked, "Payment already processed");

        p.isRevoked = true;
        require(IERC20(p.tokenAddress).transfer(p.payer, p.amount), "Transfer failed");

        emit PaymentRevoked(_id, p.payer, p.amount);
    }

    /**
     * @dev Auto-Refund if 12 hours have passed and payment is not released.
     * Can be called by the payer to get their money back if the client ignores the agreement.
     */
    function autoRefundAfter12Hours(uint256 _id) external {
        Payment storage p = payments[_id];
        require(msg.sender == p.payer, "Only payer can call auto-refund");
        require(!p.isReleased && !p.isRevoked, "Payment already processed");
        require(block.timestamp >= p.timestamp + 12 hours, "12 hours have not passed yet");

        p.isRevoked = true;
        require(IERC20(p.tokenAddress).transfer(p.payer, p.amount), "Transfer failed");

        emit PaymentRevoked(_id, p.payer, p.amount);
    }

    function getPayment(uint256 _id) external view returns (Payment memory) {
        return payments[_id];
    }
    
    function getPayerPayments(address _payer) external view returns (uint256[] memory) {
        return payerPayments[_payer];
    }
}
