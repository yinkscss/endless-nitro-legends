import { HashRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import RacePage from "./pages/RacePage";
import GaragePage from "./pages/GaragePage";
import BoardPage from "./pages/BoardPage";
import { INFO_ROUTES, InfoPage } from "./minipay/InfoPages";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<RacePage />} />
          <Route path="garage" element={<GaragePage />} />
          <Route path="board" element={<BoardPage />} />
          {INFO_ROUTES.map((r) => (
            <Route key={r.path} path={r.path} element={<InfoPage kind={r.kind} />} />
          ))}
          <Route path="*" element={<RacePage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
