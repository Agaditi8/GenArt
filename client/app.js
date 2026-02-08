import { CONTRACT_ADDRESS, ABI, PINATA_JWT } from "./constants.js";

let signer;
let provider;
let contract;
let userAddress;

// 1. --- BLOCKCHAIN CONNECTION ---
async function connect() {
    
    const btn = document.getElementById('walletBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    
    if (!window.ethereum) return alert("Please install MetaMask!");
    
    try {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        
        await provider.send("eth_requestAccounts", []);
        const network = await provider.getNetwork();
        console.log("DEBUG → chainId from ethers:", network.chainId);
        
        if (network.chainId !== 11155111) {
            alert("Please switch MetaMask to Sepolia Testnet");
            return;
        }
        signer = provider.getSigner();
        userAddress = await signer.getAddress();
        
        // --- FIX: Initialize the contract here ---
        contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
        
        // Update UI
        const shortAddress = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
        btn.innerText = shortAddress;
        btn.classList.replace('bg-white', 'bg-indigo-600');
        btn.classList.replace('text-black', 'text-white');
        
        if (disconnectBtn) {
            disconnectBtn.classList.remove('hidden');
            disconnectBtn.classList.add('flex');
        }
        
        loadPortals();
        
    } catch (err) {
        console.error("Connection Error:", err);
    }
}

// 2. --- DISCONNECT FUNCTION ---
async function disconnect() {
    signer = null;
    contract = null;
    userAddress = null;

    const btn = document.getElementById('walletBtn');
    btn.innerText = "Connect Wallet";
    btn.classList.replace('bg-indigo-600', 'bg-white');
    btn.classList.replace('text-white', 'text-black');

    const disconnectBtn = document.getElementById('disconnectBtn');
    if (disconnectBtn) {
        disconnectBtn.classList.add('hidden');
        disconnectBtn.classList.remove('flex');
    }

    showView('landing');
}

// 3. --- NAVIGATION ---
window.showView = function(viewName) {
    // Hide all views
    document.querySelectorAll('.portal-view').forEach(v => v.classList.add('hidden'));
    
    // Show target view
    const target = document.getElementById(`${viewName}-view`);
    if (target) target.classList.remove('hidden');

    // Update Nav Button Styles
    document.querySelectorAll('nav button').forEach(b => {
        b.classList.remove('text-indigo-500', 'bg-white/5');
    });
    const activeBtn = document.getElementById(`nav-${viewName}`);
    if (activeBtn) activeBtn.classList.add('text-indigo-500', 'bg-white/5');
    
    // Refresh data if wallet is connected
    if (contract) {
        loadPortals();
    }
};

// 4. --- DATA LOADING ---
async function loadPortals() {
    if (!contract) return;
    
    try {
        const count = await contract.itemCounter();
        const exploreGrid = document.getElementById('exploreGrid');
        const galleryGrid = document.getElementById('galleryGrid');
        const purchasesGrid = document.getElementById('purchasesGrid');
        
        if(exploreGrid) exploreGrid.innerHTML = "";
        if(galleryGrid) galleryGrid.innerHTML = "";
        if(purchasesGrid) purchasesGrid.innerHTML = "";

        const viewer = userAddress.toLowerCase();

        for (let i = 1; i <= count; i++) {
            const item = await contract.items(i);
            const price = ethers.utils.formatEther(item.price);
            const seller = item.seller.toLowerCase();
            const owner = item.owner.toLowerCase();
            
            // 1. Fetch the JSON metadata from IPFS
            let metadata = { image: item.metadataURI, description: "No description", attributes: [] };
            try {
                const response = await fetch(item.metadataURI);
                metadata = await response.json();
            } catch (err) {
                console.warn(`Could not load metadata for item ${i}`, err);
            }

            const isOwner = owner === viewer;
            const isSeller = seller === viewer;

            // 2. Extract Email and Insta from the attributes array
            const email = metadata.attributes?.find(a => a.trait_type === "Creator Email")?.value || "N/A";
            const insta = metadata.attributes?.find(a => a.trait_type === "Instagram")?.value || "N/A";

            // 3. Updated Card HTML with Description and Socials
            const cardHTML = `
                <div class="card-bg rounded-2xl p-4 border border-neutral-800 transition hover:border-neutral-600 flex flex-col h-full">
                    <img src="${metadata.image}" class="w-full aspect-square object-cover rounded-xl mb-4 shadow-lg">
                    
                    <div class="flex-grow">
                        <div class="flex justify-between items-center mb-2">
                            <p class="text-xl font-bold text-white">${price} ETH</p>
                            <p class="text-[10px] text-neutral-500 uppercase tracking-widest">ID #${item.id}</p>
                        </div>
                        
                        <p class="text-sm text-neutral-400 mb-4 line-clamp-3 italic">
                            "${metadata.description || 'No description provided.'}"
                        </p>

                        <div class="grid grid-cols-1 gap-1 mb-6 p-3 bg-white/5 rounded-xl border border-white/5">
                            <div class="flex items-center gap-2 text-xs">
                                <span class="text-indigo-400">📧</span>
                                <span class="text-neutral-300 truncate">${email}</span>
                            </div>
                            <div class="flex items-center gap-2 text-xs">
                                <span class="text-indigo-400">📸</span>
                                <span class="text-neutral-300 truncate">${insta}</span>
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-col gap-2 mt-auto">
                        ${!item.isSold ? 
                            `<button onclick="window.buyArt(${item.id}, '${item.price}')" class="w-full bg-white text-black py-2.5 rounded-xl font-bold hover:bg-neutral-200 transition">Buy Asset</button>` : 
                            (isOwner ? 
                                `<button onclick="window.downloadImage('${metadata.image}', 'GenArt_#${item.id}')" class="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-500 transition">Download</button>` : 
                                `<button disabled class="w-full bg-neutral-900 text-neutral-600 py-2.5 rounded-xl font-bold cursor-not-allowed">Sold</button>`
                            )
                        }
                    </div>
                </div>`;

            if (!item.isSold && exploreGrid) exploreGrid.innerHTML += cardHTML;
            if (isSeller && galleryGrid) galleryGrid.innerHTML += cardHTML;
            if (isOwner && !isSeller && purchasesGrid) purchasesGrid.innerHTML += cardHTML;
        }
    } catch (e) { 
        console.error("Portal loading failed:", e); 
    }
}

// 5. --- MINTING ---
async function mintArt() {
    if (!contract) return alert("Connect wallet first!");
    
    const file = document.getElementById('fileInput').files[0];
    const email = document.getElementById('userEmail').value;
    const insta = document.getElementById('userInsta').value;
    const description = document.getElementById('artDescription').value;
    const price = document.getElementById('artPrice').value;

    if (!file || !price || !description) return alert("Please fill in required fields.");

    try {
        // STEP 1: Upload Image to IPFS
        const imageFormData = new FormData();
        imageFormData.append('file', file);
        const imageRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
            method: "POST",
            headers: { 'Authorization': `Bearer ${PINATA_JWT}` },
            body: imageFormData
        });
        const imageData = await imageRes.json();
        const imageIPFS = `https://gateway.pinata.cloud/ipfs/${imageData.IpfsHash}`;

        // STEP 2: Create Metadata JSON
        const metadataJSON = {
            name: "GenArt Asset",
            description: description,
            image: imageIPFS,
            attributes: [
                { "trait_type": "Creator Email", "value": email },
                { "trait_type": "Instagram", "value": insta }
            ]
        };

        // STEP 3: Pin JSON to IPFS
        const jsonRes = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
            method: "POST",
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${PINATA_JWT}` 
            },
            body: JSON.stringify(metadataJSON)
        });
        const jsonData = await jsonRes.json();
        const finalMetadataURI = `https://gateway.pinata.cloud/ipfs/${jsonData.IpfsHash}`;

        // STEP 4: Save JSON URI to Blockchain
        const tx = await contract.listArt(finalMetadataURI, ethers.utils.parseEther(price));
        await tx.wait();

        alert("Manifested on Blockchain with full metadata!");
        window.showView('explore');
    } catch (e) {
        console.error("Minting failed:", e);
    }
}

// 6. --- BUYING ---
async function buyArt(id, price) {
    if (!contract) return alert("Connect wallet!");
    try {
        const tx = await contract.buyArt(id, { value: price });
        await tx.wait();
        alert("Transaction Successful!");
        loadPortals();
    } catch (e) { 
        console.error("Purchase failed:", e); 
    }
}

// 7. --- UTILITY ---
async function downloadImage(url, filename) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${filename}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
        window.open(url, '_blank');
    }
}

// 8. --- INITIALIZATION ---
window.addEventListener('load', async () => {
    if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            await connect();
        }
        window.ethereum.on('accountsChanged', () => window.location.reload());
        window.ethereum.on('chainChanged', () => window.location.reload());
    }
});

// 9. --- GLOBAL EXPORTS ---
window.connect = connect;
window.disconnect = disconnect;
window.mintArt = mintArt;
window.buyArt = buyArt;
window.downloadImage = downloadImage;