// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BalanceDelta, toBalanceDelta, BalanceDeltaLibrary} from "v4-core/src/types/BalanceDelta.sol";
import {Test} from "forge-std/Test.sol";

/// @title BalanceDeltaAssertions
/// @notice Custom foundry-like assertions for BalanceDelta from v4-core
/// @dev Based on OpenZeppelin's BalanceDeltaAssertions with additional utilities
contract BalanceDeltaAssertions is Test {
    using BalanceDeltaLibrary for BalanceDelta;

    /// @notice Assert that delta1 equals delta2 for both amount0 and amount1
    function assertEq(BalanceDelta delta1, BalanceDelta delta2) internal pure {
        assertEq(delta1.amount0(), delta2.amount0());
        assertEq(delta1.amount1(), delta2.amount1());
    }

    /// @notice Assert that delta1 equals delta2 with custom error message
    function assertEq(BalanceDelta delta1, BalanceDelta delta2, string memory err) internal pure {
        assertEq(delta1.amount0(), delta2.amount0(), err);
        assertEq(delta1.amount1(), delta2.amount1(), err);
    }

    /// @notice Assert that delta1 approximately equals delta2 within tolerance
    function assertApproxEqAbs(BalanceDelta delta1, BalanceDelta delta2, uint256 absTolerance) internal pure {
        assertApproxEqAbs(delta1.amount0(), delta2.amount0(), absTolerance);
        assertApproxEqAbs(delta1.amount1(), delta2.amount1(), absTolerance);
    }

    /// @notice Assert that delta1 approximately equals delta2 with custom error message
    function assertApproxEqAbs(
        BalanceDelta delta1,
        BalanceDelta delta2,
        uint256 absTolerance,
        string memory err
    ) internal pure {
        assertApproxEqAbs(delta1.amount0(), delta2.amount0(), absTolerance, err);
        assertApproxEqAbs(delta1.amount1(), delta2.amount1(), absTolerance, err);
    }

    /// @notice Assert that delta1 does not equal delta2
    function assertNotEq(BalanceDelta delta1, BalanceDelta delta2) internal pure {
        bool amount0Different = delta1.amount0() != delta2.amount0();
        bool amount1Different = delta1.amount1() != delta2.amount1();
        assertTrue(amount0Different || amount1Different);
    }

    /// @notice Assert that delta1 does not equal delta2 with custom error message
    function assertNotEq(BalanceDelta delta1, BalanceDelta delta2, string memory err) internal pure {
        bool amount0Different = delta1.amount0() != delta2.amount0();
        bool amount1Different = delta1.amount1() != delta2.amount1();
        assertTrue(amount0Different || amount1Different, err);
    }

    /// @notice Assert that delta1 is greater than delta2 for both amounts
    function assertGt(BalanceDelta delta1, BalanceDelta delta2) internal pure {
        assertGt(delta1.amount0(), delta2.amount0());
        assertGt(delta1.amount1(), delta2.amount1());
    }

    /// @notice Assert that delta1 is greater than delta2 with custom error message
    function assertGt(BalanceDelta delta1, BalanceDelta delta2, string memory err) internal pure {
        assertGt(delta1.amount0(), delta2.amount0(), err);
        assertGt(delta1.amount1(), delta2.amount1(), err);
    }

    /// @notice Assert that delta1 is greater than delta2 for either amount
    function assertEitherGt(BalanceDelta delta1, BalanceDelta delta2) internal pure {
        bool amount0Gt = delta1.amount0() > delta2.amount0();
        bool amount1Gt = delta1.amount1() > delta2.amount1();
        assertTrue(amount0Gt || amount1Gt);
    }

    /// @notice Assert that delta1 is greater than delta2 for either amount with custom error message
    function assertEitherGt(BalanceDelta delta1, BalanceDelta delta2, string memory err) internal pure {
        bool amount0Gt = delta1.amount0() > delta2.amount0();
        bool amount1Gt = delta1.amount1() > delta2.amount1();
        assertTrue(amount0Gt || amount1Gt, err);
    }

    /// @notice Assert that delta1 is less than delta2 for both amounts
    function assertLt(BalanceDelta delta1, BalanceDelta delta2) internal pure {
        assertLt(delta1.amount0(), delta2.amount0());
        assertLt(delta1.amount1(), delta2.amount1());
    }

    /// @notice Assert that delta1 is less than delta2 with custom error message
    function assertLt(BalanceDelta delta1, BalanceDelta delta2, string memory err) internal pure {
        assertLt(delta1.amount0(), delta2.amount0(), err);
        assertLt(delta1.amount1(), delta2.amount1(), err);
    }

    /// @notice Assert that delta1 is less than delta2 for either amount
    function assertEitherLt(BalanceDelta delta1, BalanceDelta delta2) internal pure {
        bool amount0Lt = delta1.amount0() < delta2.amount0();
        bool amount1Lt = delta1.amount1() < delta2.amount1();
        assertTrue(amount0Lt || amount1Lt);
    }

    /// @notice Assert that delta1 is less than delta2 for either amount with custom error message
    function assertEitherLt(BalanceDelta delta1, BalanceDelta delta2, string memory err) internal pure {
        bool amount0Lt = delta1.amount0() < delta2.amount0();
        bool amount1Lt = delta1.amount1() < delta2.amount1();
        assertTrue(amount0Lt || amount1Lt, err);
    }

    /// @notice Assert that delta1 is greater than or equal to delta2 for both amounts
    function assertGe(BalanceDelta delta1, BalanceDelta delta2) internal pure {
        assertGe(delta1.amount0(), delta2.amount0());
        assertGe(delta1.amount1(), delta2.amount1());
    }

    /// @notice Assert that delta1 is greater than or equal to delta2 with custom error message
    function assertGe(BalanceDelta delta1, BalanceDelta delta2, string memory err) internal pure {
        assertGe(delta1.amount0(), delta2.amount0(), err);
        assertGe(delta1.amount1(), delta2.amount1(), err);
    }

    /// @notice Assert that delta1 is less than or equal to delta2 for both amounts
    function assertLe(BalanceDelta delta1, BalanceDelta delta2) internal pure {
        assertLe(delta1.amount0(), delta2.amount0());
        assertLe(delta1.amount1(), delta2.amount1());
    }

    /// @notice Assert that delta1 is less than or equal to delta2 with custom error message
    function assertLe(BalanceDelta delta1, BalanceDelta delta2, string memory err) internal pure {
        assertLe(delta1.amount0(), delta2.amount0(), err);
        assertLe(delta1.amount1(), delta2.amount1(), err);
    }

    /// @notice Assert that a balance delta is zero
    function assertZero(BalanceDelta delta) internal pure {
        assertEq(delta.amount0(), 0);
        assertEq(delta.amount1(), 0);
    }

    /// @notice Assert that a balance delta is zero with custom error message
    function assertZero(BalanceDelta delta, string memory err) internal pure {
        assertEq(delta.amount0(), 0, err);
        assertEq(delta.amount1(), 0, err);
    }

    /// @notice Assert that a balance delta is not zero
    function assertNotZero(BalanceDelta delta) internal pure {
        bool isZero = delta.amount0() == 0 && delta.amount1() == 0;
        assertFalse(isZero);
    }

    /// @notice Assert that a balance delta is not zero with custom error message
    function assertNotZero(BalanceDelta delta, string memory err) internal pure {
        bool isZero = delta.amount0() == 0 && delta.amount1() == 0;
        assertFalse(isZero, err);
    }

    /// @notice Assert that amount0 of delta is positive
    function assertPositiveAmount0(BalanceDelta delta) internal pure {
        assertGt(delta.amount0(), 0);
    }

    /// @notice Assert that amount0 of delta is positive with custom error message
    function assertPositiveAmount0(BalanceDelta delta, string memory err) internal pure {
        assertGt(delta.amount0(), 0, err);
    }

    /// @notice Assert that amount1 of delta is positive
    function assertPositiveAmount1(BalanceDelta delta) internal pure {
        assertGt(delta.amount1(), 0);
    }

    /// @notice Assert that amount1 of delta is positive with custom error message
    function assertPositiveAmount1(BalanceDelta delta, string memory err) internal pure {
        assertGt(delta.amount1(), 0, err);
    }

    /// @notice Assert that amount0 of delta is negative
    function assertNegativeAmount0(BalanceDelta delta) internal pure {
        assertLt(delta.amount0(), 0);
    }

    /// @notice Assert that amount0 of delta is negative with custom error message
    function assertNegativeAmount0(BalanceDelta delta, string memory err) internal pure {
        assertLt(delta.amount0(), 0, err);
    }

    /// @notice Assert that amount1 of delta is negative
    function assertNegativeAmount1(BalanceDelta delta) internal pure {
        assertLt(delta.amount1(), 0);
    }

    /// @notice Assert that amount1 of delta is negative with custom error message
    function assertNegativeAmount1(BalanceDelta delta, string memory err) internal pure {
        assertLt(delta.amount1(), 0, err);
    }
}