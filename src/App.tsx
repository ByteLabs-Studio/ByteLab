function App() {
  return (
    <main className="bg-zinc-900 flex flex-col justify-center text-zinc-100 h-screen overflow-hidden">
      <h1 className="text-center text-3xl font-bold">Welcome to a ByteLab Tauri Rewrite</h1>

      <div className="flex justify-center py-4  gap-4">
        <a href="https://gitlab.com/bytelab-studio/ByteLab" target="_blank" className="select-none">
          <img src="/bl.png" className="logo react w-25" draggable={false} alt="ByteLab Icon" />
        </a>
      </div>
    </main>
  );
}

export default App;
