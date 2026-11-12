// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RaceShop
 * @notice The garage for Neon Drift, paid in G$ (GoodDollar). Players buy cars, level ups and a
 * season pass. Car 1 is the free starter car and is owned by everybody. A season pass lasts one
 * 30-day season. The contract only ever holds shop takings: the owner withdraws them.
 */
contract RaceShop is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error NotGoodDollar();
    error UnknownCar();
    error AlreadyOwned();
    error AlreadyMaxLevel();
    error AlreadyHasPass();
    error NoPacks();
    error ZeroAmount();
    error BadData();
    error ZeroAddress();

    uint256 public constant CARS = 6;
    uint256 public constant MAX_LEVEL = 10;
    uint256 public constant SEASON_SECONDS = 30 days;
    uint256 public constant LEVEL_PRICE = 60 ether;
    uint256 public constant PASS_PRICE = 200 ether;
    uint256 public constant PACK_PRICE = 30 ether;

    /// @notice The G$ token this shop takes.
    IERC20 public immutable gd;
    /// @notice When season 1 started.
    uint256 public immutable seasonStart;

    /// @notice Score multiplier level bought by a player.
    mapping(address => uint256) public level;
    /// @notice Which cars (2..6) a player bought, as a bit set.
    mapping(address => uint16) private ownedCars;
    /// @notice The season a player's pass is good for.
    mapping(address => uint256) public passSeason;
    /// @notice Power packs a player has bought and not started a run with yet.
    mapping(address => uint256) public packs;
    /// @notice G$ a player has spent in the shop (smallest unit).
    mapping(address => uint256) public spent;
    /// @notice Everything the shop has taken in.
    uint256 public totalRaised;

    event CarBought(address indexed player, uint256 indexed car, uint256 paid);
    event LevelBought(address indexed player, uint256 newLevel, uint256 paid);
    event PassBought(address indexed player, uint256 indexed season, uint256 paid);
    event PackBought(address indexed player, uint256 paid);
    event PackUsed(address indexed player);
    event Withdrawn(address indexed to, uint256 amount);

    constructor(IERC20 gd_) Ownable(msg.sender) {
        if (address(gd_) == address(0)) revert ZeroAddress();
        gd = gd_;
        seasonStart = block.timestamp;
    }

    /// @notice The season running right now, starting at 1.
    function currentSeason() public view returns (uint256) {
        return (block.timestamp - seasonStart) / SEASON_SECONDS + 1;
    }

    /// @notice True while the player's season pass is for the current season.
    function hasPass(address player) public view returns (bool) {
        return passSeason[player] == currentSeason();
    }

    /// @notice True when the player owns the car (car 1 is free for everyone).
    function hasCar(address player, uint256 car) public view returns (bool) {
        if (car == 0 || car > CARS) return false;
        if (car == 1) return true;
        return carsOf(player) & (1 << car) != 0;
    }

    /// @notice Every car a player owns, as a bit set.
    function carsOf(address player) public view returns (uint256) {
        return ownedCars[player];
    }

    /// @notice Price of a car in G$ (smallest unit). Reverts for car 1 (free) and unknown cars.
    function carPrice(uint256 car) public pure returns (uint256) {
        if (car == 2) return 150 ether;
        if (car == 3) return 350 ether;
        if (car == 4) return 700 ether;
        if (car == 5) return 1200 ether;
        if (car == 6) return 2000 ether;
        revert UnknownCar();
    }

    /// @notice A player's whole garage in one read, for the app.
    function garageOf(address player)
        external
        view
        returns (uint256 level_, uint256 cars_, bool hasPass_, uint256 spent_, uint256 season_, uint256 packs_)
    {
        return (level[player], ownedCars[player], hasPass(player), spent[player], currentSeason(), packs[player]);
    }

    /// @notice Buy a car with an approval: approve this contract for the price, then call this.
    function buyCar(uint256 car) external nonReentrant {
        uint256 price = carPrice(car);
        gd.safeTransferFrom(msg.sender, address(this), price);
        _grantCar(msg.sender, car, price);
    }

    /// @notice Buy one or more level ups with an approval (each level multiplies the score).
    function buyLevels(uint256 count) external nonReentrant {
        uint256 price = _levelPrice(count);
        gd.safeTransferFrom(msg.sender, address(this), price);
        _grantLevels(msg.sender, count, price);
    }

    /// @notice Buy this season's pass with an approval.
    function buyPass() external nonReentrant {
        gd.safeTransferFrom(msg.sender, address(this), PASS_PRICE);
        _grantPass(msg.sender, PASS_PRICE);
    }

    /// @notice Buy one power pack (a run that starts with all three power ups) with an approval.
    function buyPack() external nonReentrant {
        gd.safeTransferFrom(msg.sender, address(this), PACK_PRICE);
        _grantPack(msg.sender, PACK_PRICE);
    }

    /// @notice Spend one power pack to start a boosted run. The game reads it before the run.
    function usePowerPack() external {
        if (packs[msg.sender] == 0) revert NoPacks();
        packs[msg.sender] -= 1;
        emit PackUsed(msg.sender);
    }

    /**
     * @notice One-step G$ payment: the player calls G$.transferAndCall(thisContract, amount, data).
     * @dev data is abi.encode(uint8 kind, uint256 arg): kind 1 = car (arg is the car), kind 2 =
     * level ups (arg is how many), kind 3 = season pass (arg 0), kind 4 = power pack (arg 0).
     */
    function onTokenTransfer(address from, uint256 amount, bytes calldata data) external returns (bool) {
        if (msg.sender != address(gd)) revert NotGoodDollar();
        if (data.length != 64) revert BadData();
        (uint8 kind, uint256 arg) = abi.decode(data, (uint8, uint256));
        if (kind == 1) {
            uint256 price = carPrice(arg);
            if (amount != price) revert BadData();
            _grantCar(from, arg, price);
        } else if (kind == 2) {
            uint256 price = _levelPrice(arg);
            if (amount != price) revert BadData();
            _grantLevels(from, arg, price);
        } else if (kind == 3) {
            if (amount != PASS_PRICE) revert BadData();
            _grantPass(from, PASS_PRICE);
        } else if (kind == 4) {
            if (amount != PACK_PRICE) revert BadData();
            _grantPack(from, PACK_PRICE);
        } else {
            revert BadData();
        }
        return true;
    }

    /// @notice Send the shop's G$ takings to the owner.
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = gd.balanceOf(address(this));
        if (balance == 0) revert ZeroAmount();
        gd.safeTransfer(owner(), balance);
        emit Withdrawn(owner(), balance);
    }

    function _levelPrice(uint256 count) private pure returns (uint256) {
        if (count == 0) revert ZeroAmount();
        return count * LEVEL_PRICE;
    }

    function _grantCar(address player, uint256 car, uint256 paid) private {
        if (car == 1 || ownedCars[player] & (1 << car) != 0) revert AlreadyOwned();
        ownedCars[player] |= uint16(1 << car);
        _record(player, paid);
        emit CarBought(player, car, paid);
    }

    function _grantLevels(address player, uint256 count, uint256 paid) private {
        uint256 next = level[player] + count;
        if (next > MAX_LEVEL) revert AlreadyMaxLevel();
        level[player] = next;
        _record(player, paid);
        emit LevelBought(player, next, paid);
    }

    function _grantPass(address player, uint256 paid) private {
        if (hasPass(player)) revert AlreadyHasPass();
        uint256 season = currentSeason();
        passSeason[player] = season;
        _record(player, paid);
        emit PassBought(player, season, paid);
    }

    function _grantPack(address player, uint256 paid) private {
        packs[player] += 1;
        _record(player, paid);
        emit PackBought(player, paid);
    }

    function _record(address player, uint256 paid) private {
        spent[player] += paid;
        totalRaised += paid;
    }
}
