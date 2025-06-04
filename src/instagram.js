const axios = require('axios')
const qs = require('qs')


async function checkRedirect(url) {
    let split_url = url.split("/")
    if(split_url.includes("share")){
        let res = await axios.get(url)
        return res.request.path
    }
    return url
}

function formatPostInfo(requestData) {
    try{
        let mediaCapt = requestData.edge_media_to_caption.edges
        const capt = (mediaCapt.length === 0) ? "" : mediaCapt[0].node.text
        return {
            owner_username: requestData.owner.username,
            owner_fullname: requestData.owner.username,
            is_verified: requestData.owner.is_verified,
            is_private: requestData.owner.is_private,
            likes: requestData.edge_liked_by.count,
            is_ad: requestData.is_ad,
            caption: capt
        }
    } catch(err){
        throw new Error(`Failed to format post info: ${err.message}`)
    }
}

function formatMediaDetails(mediaData) {
    try {
        if(mediaData.is_video){
            return {
                type: "video",
                dimensions: mediaData.dimensions,
                video_view_count: mediaData.video_view_count,
                url: mediaData.video_url,
                thumbnail: mediaData.display_url
            }
        } else {
            return {
                type: "image",
                dimensions: mediaData.dimensions,
                url: mediaData.display_url
            }
        }
    } catch(err){
        throw new Error(`Failed to format media details: ${err.message}`)
    }
}

function getShortcode(url){
    try{
        let split_url = url.split("/")
        let post_tags = ["p", "reel", "tv", "reels"]
        let index_shortcode = split_url.findIndex(item => post_tags.includes(item)) + 1
        let shortcode = split_url[index_shortcode]
        return shortcode
    } catch(err){
        throw new Error(`Failed to obtain shortcode: ${err.message}`)
    }
}

async function instagramRequest(shortcode) {
    try{
        const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned`
        const embedPattern = /new ServerJS\(\)\);s\.handle\(({.*?})\);requireLazy/;
        const { data } = await axios.get(embedUrl)
        const match = embedPattern.exec(data);
        if (match) {
            const jsonData = match[1];
            const result = JSON.parse(jsonData);
            const data = JSON.parse(result.require[1][3][0]["contextJSON"]).context.media
            return data
        }
    } catch(err){
        throw new Error(`Failed instagram request: ${err.message}`)
    }
}

function createOutputData(requestData) {
    try {
        let url_list = [], media_details = []
        if (requestData.__typename == "GraphSidecar") {
            //Post with sidecar
            requestData.edge_sidecar_to_children.edges.forEach((media)=>{
                media_details.push(formatMediaDetails(media.node))
                if(media.node.is_video){ //Sidecar video item
                    url_list.push(media.node.video_url)
                } else {
                    url_list.push(requestData.display_url)
                }
            })
        } else {
            //Post without sidecar
            media_details.push(formatMediaDetails(requestData))
            if(requestData.is_video){ // Video media
                url_list.push(requestData.video_url)
            } else { //Image media
                url_list.push(requestData.display_url)
            }
        }
        return {
            results_number: url_list.length,
            url_list,
            post_info: formatPostInfo(requestData),
            media_details
        }
    } catch(err) {
        throw new Error(`Failed to create output data: ${err.message}`)
    }
}


module.exports = instagramGetUrl = (url_media) =>{
    return new Promise(async (resolve,reject)=>{
        try {
            url_media = await checkRedirect(url_media)
            const SHORTCODE = getShortcode(url_media)
            const INSTAGRAM_REQUEST = await instagramRequest(SHORTCODE)
            const OUTPUT_DATA = createOutputData(INSTAGRAM_REQUEST)
            resolve(OUTPUT_DATA)
        } catch(err){
            reject({
                error: err.message
            })
        }
    })
}
