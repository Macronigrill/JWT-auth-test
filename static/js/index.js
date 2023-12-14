document.addEventListener("DOMContentLoaded",init);

function init() {
    const login = document.getElementById("login");
    const postInput = document.getElementById("postInput");
    const postTemplate = document.querySelectorAll("div.post")[0];
    
    fetch("/user/checkauth")
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

function constructPosts(postTemplate,posts){
    console.log("test");
    posts.forEach(postData => {
        post = postTemplate.cloneNode(true);
        author = post.querySelectorAll("p")[0];
        title = post.querySelectorAll("p")[1];
        content = post.querySelectorAll("p")[2];
        author.textContent = "posted by " + postData.author;
        title.textContent = postData.post_title;
        content.textContent = postData.post_content;
        postTemplate.parentElement.appendChild(post);
    });
}


function auth(mode){
    const form = document.getElementById("authForm");
    const authData = new FormData(form);
    const request = JSON.stringify(Object.fromEntries(authData));
    var method = "POST";
    if(mode == "logout"){
        method = "DELETE"
    };
    console.log(request);
    
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
        if(mode == "register" && response.ok){
            fetch("/user/login",{
                method:"POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: request
            })
            .then(response => response.text())
        };
    })
    .then(data => {
        console.log(data);
        location.reload();
    })
    .catch(error => {
        console.log("Error: ",error);
    });
};