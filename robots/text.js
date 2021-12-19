const wikipedia = require('wikipedia')
const sentenceBoundaryDetection = require('sbd')
const luisApiKey = require('../credentials/luis-nlu.json').apiKey
const luisEndpoint = require('../credentials/luis-nlu.json').endpoint
const { TextAnalyticsClient, AzureKeyCredential } = require("@azure/ai-text-analytics");



async function robot(content) {
    await fetchContentFromWikipedia(content)
    sanitezedContent(content)
    breakContentIntoSentences(content)
    limitMaximumSentences(content)
    await fetchKeyWordsOfAllSentences(content)

    async function fetchContentFromWikipedia(content) {
        try {
            const page = await wikipedia.page(content.searchTerm)        
            const contentPage = await page.content() 

            content.sourceContentOriginal = contentPage
        } catch (error) {
            console.log(error);
        }
    }

    function sanitezedContent(content) {
        const withoutBlankLinesAndMarkdown = removeBlankLinesAndMarkdown(content.sourceContentOriginal)
        const withoutDatesInParentheses = removeDatesInParentheses(withoutBlankLinesAndMarkdown)
        
        content.sourceContentSanitized = withoutDatesInParentheses    

        function removeBlankLinesAndMarkdown(text) {
            const allLines = text.split('\n')

            const withoutBlankLinesAndMarkdown = allLines.filter((line) => {
                if (line.trim().length === 0 || line.trim().startsWith('=')) {
                    return false
                }
                return true
            })            
            return withoutBlankLinesAndMarkdown.join(' ')
        }

        function removeDatesInParentheses(text) {
            return text.replace(/\((?:\([^()]*\)|[^()])*\)/gm, '').replace(/  /g,' ')
        }
    }

    function breakContentIntoSentences(content) {
        content.sentences = []

        const sentences = sentenceBoundaryDetection.sentences(content.sourceContentSanitized)
        sentences.forEach((sentence) => {
           content.sentences.push({
               text: sentence,
               keywords:[],
               images: []
           }) 
        })
    }

    function limitMaximumSentences(content) {
        content.sentences = content.sentences.slice(0, content.maximumSentences)
    }

    async function fetchLuisAndReturnKeywords(text){
        const client = new TextAnalyticsClient(luisEndpoint, new AzureKeyCredential(luisApiKey));

        const document = [ text ]

        const keyPhraseResult = await client.extractKeyPhrases(document)

        const keyPhrases = keyPhraseResult.at(0).keyPhrases
        
        return keyPhrases;
    }

    async function fetchKeyWordsOfAllSentences(content) {
        for(const sentence of content.sentences) {
            sentence.keywords = await fetchLuisAndReturnKeywords(sentence.text)
        }
    }
    
  
}
module.exports = robot
