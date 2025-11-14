export function Paywall({ plan }) {
  const text =
    plan === "free"
      ? "You've used all 3 free insider views this month."
      : plan === "tier50"
      ? "You've used all 50 monthly insider views."
      : plan === "tier100"
      ? "You've used all 100 monthly insider views."
      : "Your plan does not allow more insider views.";

  return (
    <div className="p-4 bg-red-50 border border-red-300 rounded-lg mt-4">
      <p className="text-sm text-red-800 font-semibold">{text}</p>
      <button className="mt-2 bg-blue-600 text-white px-4 py-2 rounded">
        Upgrade Plan
      </button>
    </div>
  );
}

