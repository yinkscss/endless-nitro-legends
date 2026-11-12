// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, Actor} from "@goodbuild/Test.sol";
import {MockGoodDollar} from "@goodbuild/MockGoodDollar.sol";
import {RaceShop} from "../RaceShop.sol";

contract RaceShopTest is Test {
    MockGoodDollar gd;
    RaceShop shop;
    Actor alice;
    Actor bob;

    function setUp() public {
        gd = new MockGoodDollar();
        shop = new RaceShop(gd);
        alice = newActor();
        bob = newActor();
        gd.mint(address(alice), 5000 ether);
        gd.mint(address(bob), 5000 ether);
    }

    function testStarterCarIsFreeForEveryone() public {
        assertTrue(shop.hasCar(address(alice), 1), "car 1 free");
        assertEq(shop.level(address(alice)), 0, "no level yet");
        assertTrue(!shop.hasCar(address(alice), 2), "car 2 locked");
        expectRevert(alice, address(shop), abi.encodeCall(shop.buyCar, (1)), "AlreadyOwned");
    }

    function testBuyCarWithApproval() public {
        alice.exec(address(gd), abi.encodeCall(gd.approve, (address(shop), 150 ether)));
        alice.exec(address(shop), abi.encodeCall(shop.buyCar, (2)));
        assertTrue(shop.hasCar(address(alice), 2), "car 2 owned");
        assertEq(shop.spent(address(alice)), 150 ether, "spent counted");
        assertEq(gd.balanceOf(address(shop)), 150 ether, "shop holds G$");
        expectRevert(alice, address(shop), abi.encodeCall(shop.buyCar, (2)), "AlreadyOwned");
    }

    function testBuyCarInOneGdCall() public {
        bytes memory data = abi.encode(uint8(1), uint256(3));
        alice.exec(address(gd), abi.encodeCall(gd.transferAndCall, (address(shop), 350 ether, data)));
        assertTrue(shop.hasCar(address(alice), 3), "car 3 owned");
        assertEq(shop.totalRaised(), 350 ether, "raised");
    }

    function testOneGdCallChecksTheAmount() public {
        bytes memory data = abi.encode(uint8(1), uint256(3));
        expectRevert(alice, address(gd), abi.encodeCall(gd.transferAndCall, (address(shop), 1 ether, data)), "BadData");
        expectRevert(bob, address(shop), abi.encodeCall(shop.buyCar, (7)), "UnknownCar");
    }

    function testOnlyGoodDollarCanCallTheHook() public {
        bytes memory data = abi.encode(uint8(3), uint256(0));
        expectRevert(bob, address(shop), abi.encodeCall(shop.onTokenTransfer, (address(bob), 200 ether, data)), "NotGoodDollar");
    }

    function testLevelsUpToMax() public {
        alice.exec(address(gd), abi.encodeCall(gd.approve, (address(shop), 600 ether)));
        alice.exec(address(shop), abi.encodeCall(shop.buyLevels, (3)));
        assertEq(shop.level(address(alice)), 3, "three levels");
        alice.exec(address(gd), abi.encodeCall(gd.approve, (address(shop), 420 ether)));
        alice.exec(address(shop), abi.encodeCall(shop.buyLevels, (7)));
        expectRevert(alice, address(shop), abi.encodeCall(shop.buyLevels, (4)), "AlreadyMaxLevel");
        assertEq(shop.level(address(alice)), 10, "capped at ten");
    }

    function testSeasonPass() public {
        bytes memory data = abi.encode(uint8(3), uint256(0));
        bob.exec(address(gd), abi.encodeCall(gd.transferAndCall, (address(shop), 200 ether, data)));
        assertTrue(shop.hasPass(address(bob)), "pass is live this season");
        assertEq(shop.passSeason(address(bob)), shop.currentSeason(), "season recorded");
        expectRevert(bob, address(shop), abi.encodeCall(shop.buyPass, ()), "AlreadyHasPass");
    }

    function testPowerPacks() public {
        bytes memory data = abi.encode(uint8(4), uint256(0));
        bob.exec(address(gd), abi.encodeCall(gd.transferAndCall, (address(shop), 30 ether, data)));
        assertEq(shop.packs(address(bob)), 1, "one pack");
        bob.exec(address(shop), abi.encodeCall(shop.usePowerPack, ()));
        assertEq(shop.packs(address(bob)), 0, "pack spent");
        expectRevert(bob, address(shop), abi.encodeCall(shop.usePowerPack, ()), "NoPacks");
    }

    function testOwnerTakesTheTakings() public {
        alice.exec(address(gd), abi.encodeCall(gd.approve, (address(shop), 150 ether)));
        alice.exec(address(shop), abi.encodeCall(shop.buyCar, (2)));
        uint256 before = gd.balanceOf(address(this));
        shop.withdraw();
        assertEq(gd.balanceOf(address(this)), before + 150 ether, "owner got the takings");
        assertEq(gd.balanceOf(address(shop)), 0, "shop emptied");
        expectRevert(bob, address(shop), abi.encodeCall(shop.withdraw, ()), "owner only");
    }
}
