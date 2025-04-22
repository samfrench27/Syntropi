// Test file to verify bank ID generation
import { generateFriendlyBankId } from './token-adapter';

// Sample bank objects with all required fields
const testBanks = [
  {
    id: "original-id-1",
    name: "Bank of Scotland Business",
    bic: "test",
    logoUri: "test",
    countries: ["GB"],
    supportedLocalInstruments: [],
    supportsAccountList: true,
    supportsAccountDetails: true,
    supportsAccountBalance: true,
    supportsTransactionList: true,
    supportsTransactionDetails: true,
    supportsSinglePayment: true
  },
  {
    id: "original-id-2",
    name: "Barclays",
    bic: "test",
    logoUri: "test",
    countries: ["GB"],
    supportedLocalInstruments: [],
    supportsAccountList: true,
    supportsAccountDetails: true,
    supportsAccountBalance: true,
    supportsTransactionList: true,
    supportsTransactionDetails: true,
    supportsSinglePayment: true
  },
  {
    id: "original-id-3",
    name: "Lloyds Business Banking",
    bic: "test",
    logoUri: "test",
    countries: ["GB"],
    supportedLocalInstruments: [],
    supportsAccountList: true,
    supportsAccountDetails: true,
    supportsAccountBalance: true,
    supportsTransactionList: true,
    supportsTransactionDetails: true,
    supportsSinglePayment: true
  }
];

// Test ID generation
console.log("Generated Bank IDs:");
testBanks.forEach(bank => {
  console.log(`${bank.name} -> ${generateFriendlyBankId(bank)}`);
}); 