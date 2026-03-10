import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div
        className="flex flex-1 flex-col overflow-hidden transition-all duration-300"
        style={{
          marginLeft: typeof window !== 'undefined' && window.innerWidth < 768 ? 0 : undefined,
        }}
      >
        <Topbar />
        <main className="flex-1 overflow-y-auto p-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
