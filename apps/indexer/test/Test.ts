// import assert from "assert";
// import {
//   TestHelpers,
//   PositionManager_Approval
// } from "generated";
// const { MockDb, PositionManager } = TestHelpers;

// describe("PositionManager contract Approval event tests", () => {
//   // Create mock db
//   const mockDb = MockDb.createMockDb();

//   // Creating mock for PositionManager contract Approval event
//   const event = PositionManager.Approval.createMockEvent({/* It mocks event fields with default values. You can overwrite them if you need */});

//   it("PositionManager_Approval is created correctly", async () => {
//     // Processing the event
//     const mockDbUpdated = await PositionManager.Approval.processEvent({
//       event,
//       mockDb,
//     });

//     // Getting the actual entity from the mock database
//     let actualPositionManagerApproval = mockDbUpdated.entities.PositionManager_Approval.get(
//       `${event.chainId}_${event.block.number}_${event.logIndex}`
//     );

//     // Creating the expected entity
//     const expectedPositionManagerApproval: PositionManager_Approval = {
//       id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
//       owner: event.params.owner,
//       spender: event.params.spender,
//       id: event.params.id,
//     };
//     // Asserting that the entity in the mock database is the same as the expected entity
//     assert.deepEqual(actualPositionManagerApproval, expectedPositionManagerApproval, "Actual PositionManagerApproval should be the same as the expectedPositionManagerApproval");
//   });
// });
