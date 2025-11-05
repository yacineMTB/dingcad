// Test helper functions for DingCAD tests
// Include this at the top of test files to use helper functions

// Assert function - throws error if condition is false
function assert(condition, message) {
    if (!condition) {
        const errorMsg = message || "Assertion failed";
        throw new Error(errorMsg);
    }
}

// Print function - outputs message (may be captured by test runner)
function print(message) {
    // In QuickJS context, this will be visible in console
    // For test output, we can use console.log if available
    if (typeof console !== 'undefined' && typeof console.log === 'function') {
        console.log(message);
    }
}

// Assert approximate equality (useful for floating point comparisons)
function assertApprox(actual, expected, tolerance, message) {
    const error = Math.abs(actual - expected);
    const msg = message || `Expected ${expected}, got ${actual} (error: ${error})`;
    assert(error < tolerance, msg);
}

// Assert that object is not empty
function assertNotEmpty(obj, message) {
    assert(!isEmpty(obj), message || "Object should not be empty");
}

// Assert that object is empty
function assertEmpty(obj, message) {
    assert(isEmpty(obj), message || "Object should be empty");
}

// Assert valid status
function assertValidStatus(obj, message) {
    const statusStr = status(obj);
    assert(statusStr === "NoError", message || `Expected NoError, got ${statusStr}`);
}

// Assert positive volume
function assertPositiveVolume(obj, message) {
    const vol = volume(obj);
    assert(vol > 0, message || `Expected positive volume, got ${vol}`);
}

// Assert volume is approximately correct
function assertVolumeApprox(obj, expected, tolerance, message) {
    const actual = volume(obj);
    assertApprox(actual, expected, tolerance || expected * 0.1, 
                 message || `Volume should be approximately ${expected}`);
}

// Test summary helper
function testSummary(testName, passed, failed) {
    const total = passed + failed;
    const passRate = total > 0 ? (passed / total * 100).toFixed(1) : 0;
    print(`\n${testName} Summary: ${passed}/${total} passed (${passRate}%)`);
    if (failed > 0) {
        print(`  Failed: ${failed}`);
    }
}

