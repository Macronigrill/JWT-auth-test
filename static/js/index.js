
document.addEventListener("DOMContentLoaded",init);

function init() {
    const login = document.getElementById("login");
    const postInput = document.getElementById("postInput");
    const postContainer = document.getElementById("postContainer");
    const postTemplate = postContainer.querySelectorAll("div.post")[0].cloneNode(true);
    postContainer.querySelectorAll("div.post")[0].remove();
    
    fetch("/user/getAuth")
    .then(response => response.json())
    .then(data => {
        console.log(data.user);
        if(data.user) {
            login.classList.add("hidden");
            postInput.classList.remove("hidden");
            postInput.querySelectorAll("p")[0].textContent += data.user;
        }
    })
    
    fetch("/posts/get")
    .then(response => response.json())
    .then(data =>{
        console.log(data);
        constructPosts(postTemplate,data);
    })
};

async function constructPosts(postTemplate,posts){
    const user_data = await fetch("/user/getAuth")
        .then(response => response.json())
    console.log(user_data);
    posts.author_id = user_data.id;
    
    posts.forEach(postData => {
        post = postTemplate.cloneNode(true);
        author = post.querySelectorAll("p")[0];
        title = post.querySelectorAll("p")[1];
        content = post.querySelectorAll("p")[2];
        delButton = post.querySelectorAll("button")[0];
        author.textContent = "posted by " + postData.author;
        title.textContent = postData.post_title;
        content.textContent = postData.post_content;
        if (postData.author_id == posts.author_id) {
            delButton.addEventListener("click",()=>{
                fetch(`/posts/delete?title=${postData.post_title}`,{method: "DELETE"})
                .then(response => response.json())
                .then(location.reload());
            })
        } else {
            post.removeChild(delButton);
        }

        postContainer.appendChild(post);
    });
};

function createPost(){
    const form = document.getElementById("postForm");
    const postData = new FormData(form);
    const request = JSON.stringify(Object.fromEntries(postData));
    console.log(request);
    fetch("/posts/create",{
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: request
    })
    .then(response => response.text())
    .then(data => {console.log(data)})
    .catch(error => {console.log(error)});
    location.reload();
};

function auth(mode,body){
    const form = document.getElementById("authForm");
    if(!body) {    
        const authData = new FormData(form);
        var request = JSON.stringify(Object.fromEntries(authData));
        console.log(body);
    } else {
        var request = body;
    } 
    var method = "POST";
    if(mode == "logout"){
        method = "DELETE"
    };
    
    const url = "/user/" + mode;
    fetch(url,{
        method: method,
        headers: {
            "Content-Type": "application/json"
        },
        body: request
    })
    .then(response => {
        response.text()
    })
    .then(data => {
        console.log(data);
        if(mode == "register"){
            auth("login",request);
        } else {
            location.reload()
        };
    })
    .catch(error => {
        console.log("Error: ",error);
    });

};

