import { BrowserRouter, Routes, Route } from 'react-router-dom';

function HomePlaceholder() {
  return <h1>Reloop</h1>;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<HomePlaceholder />} />
      </Routes>
    </BrowserRouter>
  );
}
