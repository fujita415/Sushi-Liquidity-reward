//SPDX-License-Identifier: MIT
pragma solidity >=0.6.6 <=0.9.0;
pragma experimental ABIEncoderV2;

import "./Ownable.sol";
import "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IMasterChef.sol";

contract SushiSwapWallet is Ownable {
    IUniswapV2Router02 public router;
    IMasterChef public chef;
    IWETH public WETH;

    event Stake(uint256 pid, uint256 liquidity);

    modifier check(address[] memory tokens, uint256[] memory amounts) {
        require(
            (tokens.length == 1 && amounts.length == 1) ||
                (tokens.length == 2 && amounts.length == 2),
            "invalid length of tokens or amounts"
        );
        for (uint256 i; i < tokens.length; i++) {
            require(
                IERC20(tokens[i]).balanceOf(msg.sender) >= amounts[i],
                "SushiWallet: Insufficient token balance"
            );
            require(
                IERC20(tokens[i]).allowance(msg.sender, address(this)) >=
                    amounts[i],
                "SushiWallet: Insufficient allowance"
            );
        }
        _;
    }

    constructor(address _router, address _chef, address _weth) public {
        router = IUniswapV2Router02(_router);
        chef = IMasterChef(_chef);
        WETH = IWETH(_weth);
    }

    function pending(uint256 _pid) public view returns (uint256 pendingSushi) {
        pendingSushi = chef.pendingSushi(_pid, address(this));
    }

    function staked(uint256 _pid) external view returns (uint256 staked) {
        staked = chef.userInfo(_pid, address(this)).amount;
    }


    /// @notice This is the function which fulfill main goal of this contract.
    function deposit(
        address[] memory _tokens,
        uint256[] memory _amounts,
        uint256 _amountAMin,
        uint256 _amountBMin,
        uint256 _pid
    ) public payable onlyOwner check(_tokens, _amounts) {
        IUniswapV2Router02 _router = router;
        IWETH _weth = WETH;

        address _tokenB;
        uint256 _amountBDesired;

        if (_tokens.length == 2) {
            _tokenB = _tokens[1];
            _amountBDesired = _amounts[1];

            if (msg.value > 0) payable(msg.sender).call{value: msg.value}("");
        } else {
            _tokenB = address(_weth);
            _amountBDesired = msg.value;
        }

        (uint256 amountA, uint256 amountB) = _getOptimalAmounts(
            _tokens[0],
            _tokenB,
            _amounts[0],
            _amountBDesired,
            _amountAMin,
            _amountBMin
        );

        IERC20(_tokens[0]).transferFrom(msg.sender, address(this), amountA);

        if (_tokens.length == 1) {
            _weth.deposit{value: amountB}();
            // refund remaining ETH
            if (msg.value > amountB)
                payable(msg.sender).call{value: msg.value - amountB}("");
        } else {
            IERC20(_tokenB).transferFrom(msg.sender, address(this), amountB);
        }

        IERC20(_tokens[0]).approve(address(_router), amountA);
        IERC20(_tokenB).approve(address(_router), amountB);

        (, , uint256 liquidity) = _router.addLiquidity(
            _tokens[0],
            _tokenB,
            amountA,
            amountB,
            0,
            0,
            address(this),
            block.timestamp + 30 minutes
        );
        _stake(liquidity, _pid);
    }

    function withdraw(uint256 _pid, uint256 _amount) external onlyOwner {
        IUniswapV2Pair lp = IUniswapV2Pair(_withdraw(_pid, _amount));
        if (_amount > 0) {
            // save gas
            IUniswapV2Router02 _router = router;
            lp.approve(address(_router), _amount);
            _router.removeLiquidity(
                lp.token0(),
                lp.token1(),
                _amount,
                0,
                0,
                msg.sender,
                block.timestamp + 30 minutes
            );
        }
    }

    function emergencyWithdraw(uint256 _pid) external onlyOwner {
        IMasterChef _chef = chef;
        require(_pid <= _chef.poolLength(), "SushiWallet: Invalid pid");
        uint256 amount = _chef.userInfo(_pid, address(this)).amount;
        _chef.emergencyWithdraw(_pid);

        IERC20 lp = _chef.poolInfo(_pid).lpToken;
        lp.transfer(msg.sender, amount);
    }

    function _harvest() private {
        IERC20 sushi = chef.sushi();
        uint256 sushiBal = sushi.balanceOf(address(this));
        if (sushiBal > 0) sushi.transfer(msg.sender, sushiBal);
    }

    /// function which interacts directly with MasterChef to deposit and farm lp tokens.
    function _stake(uint256 _amount, uint256 _pid) private {
        IMasterChef _chef = chef;
        require(_pid <= _chef.poolLength(), "SushiWallet: Invalid pid");
        address _lp = address(_chef.poolInfo(_pid).lpToken);

        IERC20(_lp).approve(address(_chef), _amount);
        _chef.deposit(_pid, _amount);
        _harvest();
        emit Stake(_pid, _amount);
    }

    function _withdraw(
        uint256 _pid,
        uint256 _amount
    ) private returns (address lp) {
        // Save gas
        IMasterChef _chef = chef;
        require(_pid <= _chef.poolLength(), "SushiWallet: Invalid pid");

        lp = address(_chef.poolInfo(_pid).lpToken);
        _chef.withdraw(_pid, _amount);
        _harvest();
    }

    function _getOptimalAmounts(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) private view returns (uint256 amountA, uint256 amountB) {
        (uint256 reserveA, uint256 reserveB) = UniswapV2Library.getReserves(
            router.factory(),
            tokenA,
            tokenB
        );
        uint256 amountBOptimal = UniswapV2Library.quote(
            amountADesired,
            reserveA,
            reserveB
        );
        if (amountBOptimal <= amountBDesired) {
            require(
                amountBOptimal >= amountBMin,
                "SushiWallet: INSUFFICIENT_B_AMOUNT"
            );
            (amountA, amountB) = (amountADesired, amountBOptimal);
        } else {
            uint256 amountAOptimal = UniswapV2Library.quote(
                amountBDesired,
                reserveB,
                reserveA
            );
            assert(amountAOptimal <= amountADesired);
            require(
                amountAOptimal >= amountAMin,
                "SushiWallet: INSUFFICIENT_A_AMOUNT"
            );
            (amountA, amountB) = (amountAOptimal, amountBDesired);
        }
    }
}
