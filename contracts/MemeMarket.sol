pragma solidity 0.5.16;

contract MemeMarket {
    struct Meme{
        address author;
        string name;
        string image;
        uint256 price;
        uint256[] history;
        uint256[] timeHistory;
        uint forSale;
    }

    struct Vote{
        uint[] memeIndices;
        uint happyCompilerNoises;
    }

    string worked;
    constructor() public {
        worked = "yaaaaas";
    }

    Meme[] public memes;
    uint[] public validMemeIndices;
    bool[] public isValid;
    address[] users;
    mapping(address => bool) public userExisted;
    mapping(address => uint256) public balances;
    mapping(address => bool) public voteExists;
    mapping(address => Vote) public lastVote;
    mapping(address => mapping(uint => uint)) public shares;

    uint256 public initialPayment = 1e17;
    uint256 public voteValue = initialPayment/10;
    uint256 public voterPayout = voteValue/100;
    uint256 public numShares = 100;

    function uploadMeme(string memory name, string memory image) public {
        require(balances[msg.sender] >= initialPayment);
        balances[msg.sender] -= initialPayment;
        uint256[] memory history;
        uint256[] memory timeHistory;
        Meme memory meme = Meme(msg.sender, name, image, initialPayment, history, timeHistory, 0);
        memes.push(meme);
        validMemeIndices.push(memes.length-1);
        isValid.push(true);
        shares[msg.sender][memes.length-1] = numShares;
    }

    function max(uint a, uint b) internal returns (uint ans) {
        if(a > b) return a;
        return b;
    }

    function sharePrice(uint meme) public returns (uint256) {
        return memes[meme].price;
    }

    function priceHistory(uint meme) public returns (uint256[] memory) {
        return memes[meme].history;
    }

    function sellShares(uint meme, uint amount) public {
        require(shares[msg.sender][meme] >= amount);
        shares[msg.sender][meme] -= amount;
        memes[meme].forSale += amount;
        balances[msg.sender] += amount*(memes[meme].price/numShares);
    }

    function ownedShares() public returns (uint[] memory){
        uint numOwnedShares = 0;
        for(uint i=0;i<memes.length;i++){
            if(shares[msg.sender][i] > 0) {
                numOwnedShares++;
            }
        }
        uint[] memory shareIndices = new uint[](numOwnedShares);
        uint v = 0;
        for(uint i=0;i<memes.length;i++){
            if(shares[msg.sender][i] > 0) {
                shareIndices[v] = i;
                v++;
            }
        }
        return shareIndices;
    }

    function ownedMemes() public returns (uint[] memory){
        uint numOwnedMemes = 0;
        for(uint i=0;i<memes.length;i++){
            if(memes[i].author == msg.sender){
                numOwnedMemes++;
            }
        }
        uint[] memory memeIndices = new uint[](numOwnedMemes);
        uint v = 0;
        for(uint i=0;i<memes.length;i++){
            if(memes[i].author == msg.sender){
                memeIndices[v] = i;
                v++;
            }
        }
        return memeIndices;
    }

    function amountStaked(uint meme) public returns(uint){
        return shares[msg.sender][meme];
    }

    function buyShares(uint meme, uint amount) public {
        require(memes[meme].forSale >= amount);
        uint256 payOut = amount*(memes[meme].price/numShares);
        require(balances[msg.sender] >= payOut);
        memes[meme].forSale -= amount;
        balances[msg.sender] -= payOut;
        shares[msg.sender][meme] += amount;
    }

    function memesLength() public returns (uint) {
        return memes.length;
    }

    function getVotingOptions() public returns (string memory a, string memory b, string memory c, string memory d){
        require(validMemeIndices.length >= 4);
        if(!voteExists[msg.sender]){
            uint[] memory fourValues = new uint[](4);
            lastVote[msg.sender] = Vote(fourValues,0);
            voteExists[msg.sender] = true;

            uint[] memory usableMemes = validMemeIndices;
            for(uint v=0;v<4;v++){
                uint chosenIndex = (uint(keccak256(abi.encodePacked(block.timestamp))) % usableMemes.length);
                lastVote[msg.sender].memeIndices[v] = usableMemes[chosenIndex];
                uint[] memory newUsableMemes = new uint[](usableMemes.length-1);
                uint j = 0;
                for(uint i=0;i<usableMemes.length;i++){
                    if(i != chosenIndex){
                        newUsableMemes[j] = usableMemes[i];
                        j++;
                    }
                }
                usableMemes = newUsableMemes;
            }
        }
        string memory ret0 = memes[lastVote[msg.sender].memeIndices[0]].image;
        string memory ret1 = memes[lastVote[msg.sender].memeIndices[1]].image;
        string memory ret2 = memes[lastVote[msg.sender].memeIndices[2]].image;
        string memory ret3 = memes[lastVote[msg.sender].memeIndices[3]].image;
        return (
        ret0, ret1, ret2, ret3
        );
    }

    function vote(uint votedMeme) public {
        require(voteExists[msg.sender] == true);

        memes[lastVote[msg.sender].memeIndices[votedMeme]].price += voteValue-voterPayout;
        memes[lastVote[msg.sender].memeIndices[votedMeme]].history.push(memes[lastVote[msg.sender].memeIndices[votedMeme]].price);
        memes[lastVote[msg.sender].memeIndices[votedMeme]].timeHistory.push(block.timestamp);
        balances[msg.sender] += voterPayout;

        for(uint i=0;i<4;i++){
            if(i != votedMeme){
                uint memeIndex = lastVote[msg.sender].memeIndices[i];
                memes[memeIndex].price -= voteValue;
                memes[memeIndex].history.push(memes[memeIndex].price);
                memes[memeIndex].history.push(block.timestamp);
                if(memes[memeIndex].price <= voteValue){
                    uint[] memory newValidMemeIndices = new uint[](validMemeIndices.length-1);
                    uint j = 0;
                    for(uint v=0;v<validMemeIndices.length;v++){
                        if(validMemeIndices[v] != memeIndex){
                            newValidMemeIndices[j] = validMemeIndices[v];
                            j++;
                        }
                    }
                    validMemeIndices = newValidMemeIndices;
                    isValid[memeIndex] = false;
                }
            }
        }
        voteExists[msg.sender] = false;
    }

    function deposit() public payable {
        if(!userExisted[msg.sender]){
            userExisted[msg.sender] = true;
            users.push(msg.sender);
        }
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount);
        address payable user = address(uint160(msg.sender));
        user.transfer(amount);
        balances[msg.sender] -= amount;
    }
}