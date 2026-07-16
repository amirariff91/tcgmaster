export default function RootLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="min-h-screen w-full bg-[#060c18] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500/20 border-t-orange-500" />
      </div>
    </div>
  );
}
