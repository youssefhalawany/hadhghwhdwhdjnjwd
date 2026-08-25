import FinancialInputsLayout from "./financials/inputs/layout";
import FinancialInputsOverview from "./financials/inputs/page";

export default function Home() {
  return (
    <FinancialInputsLayout>
      <FinancialInputsOverview />
    </FinancialInputsLayout>
  );
}
