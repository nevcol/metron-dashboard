import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Overview from "./pages/Overview";
import Athletes from "./pages/Athletes";
import AthleteProfile from "./pages/AthleteProfile";
import Testing from "./pages/Testing";
import Results from "./pages/Results";
import Correlations from "./pages/Correlations";
import PeerComparison from "./pages/PeerComparison";
import Periodization from "./pages/Periodization";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/athletes" element={<Athletes />} />
        <Route path="/athletes/:id" element={<AthleteProfile />} />
        <Route path="/testing" element={<Testing />} />
        <Route path="/results" element={<Results />} />
        <Route path="/correlations" element={<Correlations />} />
        <Route path="/peers" element={<PeerComparison />} />
        <Route path="/periodization" element={<Periodization />} />
      </Routes>
    </Layout>
  );
}
