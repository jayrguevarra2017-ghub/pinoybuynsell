export const categories = [
  { name: "Electronics", icon: "📱" },
  { name: "Phones", icon: "📞" },
  { name: "Fashion", icon: "👕" },
  { name: "Home & Living", icon: "🏠" },
  { name: "Vehicles", icon: "🚗" },
  { name: "Sports", icon: "⚽" },
  { name: "Jobs & Services", icon: "🧰" },
  { name: "Others", icon: "📦" },
];

export const products = [
  { id: "iphone-15", title: "iPhone 15 128GB", price: 32500, location: "Manila", condition: "Like New", icon: "📱", category: "Phones" },
  { id: "gaming-laptop", title: "Gaming Laptop", price: 45000, location: "Quezon City", condition: "Good Condition", icon: "💻", category: "Electronics" },
  { id: "mountain-bike", title: "Mountain Bike", price: 12000, location: "Cebu City", condition: "Used", icon: "🚲", category: "Sports" },
  { id: "sony-camera", title: "Sony Camera", price: 28000, location: "Makati", condition: "Like New", icon: "📷", category: "Electronics" },
  { id: "sneakers", title: "Premium Sneakers", price: 4800, location: "Pasig", condition: "Brand New", icon: "👟", category: "Fashion" },
  { id: "coffee-table", title: "Wood Coffee Table", price: 6500, location: "Taguig", condition: "Good Condition", icon: "🪑", category: "Home & Living" },
];

export const auctions = [
  { id: "macbook-air-auction", title: "MacBook Air M2", currentBid: 42000, endTime: "2026-10-02T21:00:00+08:00", location: "Manila", icon: "💻", bids: 12 },
  { id: "sneakers-auction", title: "Limited Edition Sneakers", currentBid: 7800, endTime: "2026-10-02T22:15:00+08:00", location: "Makati", icon: "👟", bids: 8 },
  { id: "camera-auction", title: "Sony Alpha Camera", currentBid: 31500, endTime: "2026-10-03T19:30:00+08:00", location: "Quezon City", icon: "📷", bids: 16 },
];

export function peso(value) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);
}
