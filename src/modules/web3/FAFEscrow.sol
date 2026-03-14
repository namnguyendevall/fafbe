// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title FAFEscrow
 * @dev Decentralized escrow for Freelance jobs on the FAF Platform.
 */
contract FAFEscrow {
    address public platformAdmin;
    uint256 public feePercentage = 3; // 3% platform fee

    struct JobEscrow {
        uint256 jobId;
        address client;
        address worker;
        uint256 totalBudget;
        uint256 releasedAmount;
        bool isFunded;
        bool isCompleted;
        bool isDisputed;
    }

    // Mapping from Job ID to Escrow Details
    mapping(uint256 => JobEscrow) public escrows;

    event JobFunded(uint256 indexed jobId, address indexed client, uint256 amount);
    event MilestoneReleased(uint256 indexed jobId, address indexed worker, uint256 amount);
    event JobCompleted(uint256 indexed jobId);
    event DisputeRaised(uint256 indexed jobId);
    event DisputeResolved(uint256 indexed jobId, uint256 workerAmount, uint256 clientRefund);

    modifier onlyAdmin() {
        require(msg.sender == platformAdmin, "Not authorized");
        _;
    }

    constructor() {
        platformAdmin = msg.sender;
    }

    /**
     * @dev Client deposits funds to strictly lock the budget for a job.
     * Over-payments are not allowed. Exact budget required.
     */
    function fundJob(uint256 _jobId, address _worker) external payable {
        require(msg.value > 0, "Amount must be greater than 0");
        require(!escrows[_jobId].isFunded, "Job already funded");

        escrows[_jobId] = JobEscrow({
            jobId: _jobId,
            client: msg.sender,
            worker: _worker,
            totalBudget: msg.value,
            releasedAmount: 0,
            isFunded: true,
            isCompleted: false,
            isDisputed: false
        });

        emit JobFunded(_jobId, msg.sender, msg.value);
    }

    /**
     * @dev Platform admin calls this when a Checkpoint is approved to release partial funds to the worker.
     */
    function releaseMilestone(uint256 _jobId, uint256 _amount) external onlyAdmin {
        JobEscrow storage job = escrows[_jobId];
        require(job.isFunded, "Job not funded");
        require(!job.isCompleted, "Job already completed");
        require(!job.isDisputed, "Job is in dispute");
        require(job.releasedAmount + _amount <= job.totalBudget, "Exceeds total budget");

        job.releasedAmount += _amount;
        
        // Calculate fee
        uint256 fee = (_amount * feePercentage) / 100;
        uint256 payout = _amount - fee;

        payable(job.worker).transfer(payout);
        payable(platformAdmin).transfer(fee);

        emit MilestoneReleased(_jobId, job.worker, payout);
    }

    /**
     * @dev Mark job as fully completed.
     */
    function completeJob(uint256 _jobId) external onlyAdmin {
        JobEscrow storage job = escrows[_jobId];
        require(job.isFunded, "Not funded");
        
        if (job.totalBudget > job.releasedAmount) {
            // Auto release remaining funds
            uint256 remaining = job.totalBudget - job.releasedAmount;
            job.releasedAmount += remaining;
            
            uint256 fee = (remaining * feePercentage) / 100;
            uint256 payout = remaining - fee;

            payable(job.worker).transfer(payout);
            payable(platformAdmin).transfer(fee);
            emit MilestoneReleased(_jobId, job.worker, payout);
        }

        job.isCompleted = true;
        emit JobCompleted(_jobId);
    }

    /**
     * @dev Raise a dispute, locking funds.
     */
    function raiseDispute(uint256 _jobId) external {
        JobEscrow storage job = escrows[_jobId];
        require(msg.sender == job.client || msg.sender == job.worker, "Not authorized");
        require(!job.isCompleted, "Already completed");
        
        job.isDisputed = true;
        emit DisputeRaised(_jobId);
    }

    /**
     * @dev Admin resolves the dispute, splitting remaining funds.
     */
    function resolveDispute(uint256 _jobId, uint256 _workerAmount, uint256 _clientRefund) external onlyAdmin {
        JobEscrow storage job = escrows[_jobId];
        require(job.isDisputed, "Not in dispute");
        
        uint256 remaining = job.totalBudget - job.releasedAmount;
        require(_workerAmount + _clientRefund <= remaining, "Resolution exceeds balance");

        if (_workerAmount > 0) {
            job.releasedAmount += _workerAmount;
            payable(job.worker).transfer(_workerAmount);
        }
        if (_clientRefund > 0) {
            job.releasedAmount += _clientRefund;
            payable(job.client).transfer(_clientRefund);
        }

        job.isCompleted = true;
        job.isDisputed = false;
        
        emit DisputeResolved(_jobId, _workerAmount, _clientRefund);
    }
}
