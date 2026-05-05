import json
import torch



def get_textual_descriptions_for_geo_element(text: str, geo_element, model, tokenizer):
    prompt = """【Role】You are an expert in geographical knowledge and geographical writing. You are tasked with continuing a given text. I will provide you with "textContent" and "geo_element". The value of "textContent" represents the existing text, while the value of "geo_element" is in JSON format and contains information about the geographic element that needs to be described, such as its name and visual encoding on the map.

【Task Description】Your task is to:
Continue the text naturally, maintaining the original writing style.
Incorporate geographical descriptions related to the "geo_element" in your continuation.
Ensure a smooth transition between the existing text and your addition.
Provide only the continued text in your response, without any additional commentary.
Start your response directly with the new text, excluding the content from "textContent".

【Note】Please note that the visual encoding (e.g., color) in provided "geo_element" refers to the visual form of geographical elements in the article's illustrations, not that geographical elements have such visual encoding in real life. Therefore, you should not describe how a geographical name has such visual encoding in reality, but rather how it appears in the illustrations.

【Output Format】 
You need to generate several different text descriptions to offer greater variety and allow users to choose. 
Therefore, your output must strictly adhere to the following format:
- The entire output should be a single array.
- Each element in the array is a complete string (enclosed in double quotation marks `" "`).
- Strings must be separated by commas `,`.
- The array must begin with `[` and end with `]`. 

For example, your output should look like this:
["Description 1", "Description 2", "Description 3"]

Do not include any other text, explanation, or formatting outside of this array. Just return the array.


【Your Task】Now, generate the continuation content based on the "textContent" and "newLocation" provided below.
The "textContent" is:""" + text + """
The "geo_element" is:"""+ str(geo_element) + """
Your generated:"""



    # print(prompt)

    messages = [
        {"role": "user", "content": prompt}
    ]
    
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    
    model_inputs = tokenizer([text], return_tensors="pt").to(model.device)
    
    with torch.no_grad():
        generated_ids = model.generate(
            **model_inputs,
            max_new_tokens=1024,
            temperature=0.1,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )
    
    response = tokenizer.decode(generated_ids[0][len(model_inputs.input_ids[0]):], skip_special_tokens=True)

    return response




def get_generated_text_based_on_a_place(text: str, place_name, model, tokenizer):
    prompt = """【Role】You are an expert in geographical knowledge and geographical writing. You are tasked with continuing a given text. I will provide you with "textContent" and "newLocation". The value of "textContent" represents the existing text, while "newLocation" contains hints about the content to be added.

【Task Description】Your task is to:
Continue the text naturally, maintaining the original writing style.
Incorporate geographical knowledge related to the "newLocation" in your continuation.
Ensure a smooth transition between the existing text and your addition.
Provide only the continued text in your response, without any additional commentary.
Start your response directly with the new text, excluding the content from "textContent".

【Example】
textContent: In the early morning, I arrived at Hangzhou East Railway Station, feeling a hint of excitement amidst the slightly cool breeze. My first destination was the Hangzhou West Lake Scenic Area. The sun shone on the calm lake, casting golden specks of light, while the weeping willows on the Su Causeway swayed in the wind, looking particularly charming. I strolled along the lakeside, gazing at the Leifeng Pagoda in the distance, and sat quietly on a bench, feeling as if time had slowed down. The beautiful scenery of West Lake is indeed worthy of its reputation, leaving one feeling refreshed and relaxed.

In the afternoon, we embarked on a journey to the Zhejiang University Zijin'gang Campus. This historic institution is nestled beside the beautiful West Lake, with lush greenery lining the campus paths and an elegant environment. Located in the Xihu District of Hangzhou, the Zijin'gang Campus is one of the important higher education bases in Zhejiang Province and even nationwide. As we strolled along the campus paths, we were flanked by well-proportioned teaching buildings and laboratories, and occasionally saw students reading or discussing issues on the grass. The Zijin'gang Campus not only boasts a strong academic atmosphere but also offers a pleasant natural landscape, making it an ideal place for learning and scientific research.

newLocation: "Hangzhou West Railway Station"

So your generated content could be: We headed to Hangzhou West Railway Station, a modern railway station located beside Yunyu East Street, serving as a transportation hub connecting Hangzhou with surrounding cities. From here, we can take direct trains to multiple cities within Zhejiang Province, and even take high-speed trains directly to Shanghai, Nanjing, and other places. This newly built railway station is very technological and beautiful, and during our waiting time, we enjoyed the exhibition corridor showcasing the development and construction of Yuhang District in recent years. Finally, we left Hangzhou by taking a high-speed train.

【TODO】Now, generate the continuation content in pure English based on the "textContent" and "newLocation" provided below. 
The "textContent" is:""" + text + """
The "newLocation" is:"""+ place_name + """
Your generated content:"""


    
    # print(prompt)

    messages = [
        {"role": "user", "content": prompt}
    ]
    
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    
    model_inputs = tokenizer([text], return_tensors="pt").to(model.device)
    
    with torch.no_grad():
        generated_ids = model.generate(
            **model_inputs,
            max_new_tokens=1024,
            temperature=0.1,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )
    
    response = tokenizer.decode(generated_ids[0][len(model_inputs.input_ids[0]):], skip_special_tokens=True)

    return response


def get_generated_descriptions_of_spatial_relationships(place_names, model, tokenizer):
    prompt = """【Role】You are an expert in geographical knowledge and geographical writing. I will give you some place names, and you need to generate textual description of the relationships among the given place names.

【Examples】
Example 1: Given the place names "Beijing" and "Shanghai", the generated text might look like this: "Beijing and Shanghai are 1,000 kilometers apart... They are respectively the political and financial centers of China..."

Example 2: Given highway G60 and three cities A, B, and C along its route, you might generate the sentence: "The highway G60 facilitates travel between the surrounding cities A, B, and C."


【Your Task】
Now, generate the content based on the place names provided below.
The place names are:"""+ str(place_names) + """
Your generated content:"""



    # print(prompt)

    messages = [
        {"role": "user", "content": prompt}
    ]
    
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    
    model_inputs = tokenizer([text], return_tensors="pt").to(model.device)
    
    with torch.no_grad():
        generated_ids = model.generate(
            **model_inputs,
            max_new_tokens=1024,
            temperature=0.1,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )
    
    response = tokenizer.decode(generated_ids[0][len(model_inputs.input_ids[0]):], skip_special_tokens=True)

    return response


def get_generated_analytical_summary_of_the_data(text: str, imported_data, model, tokenizer):
    prompt = """【Role】You are an expert in geographical knowledge and geographical writing. I will provide a CSV file. You need to analyze the patterns in the data and then write a data analysis summary based on the given existing text.

【Output Format】Your output should only contain the generated content itself; do not include any additional comments or explanations.

Now, use the SCV data provided below to generate the continuation content based on the existing text's style.
The existing text is:""" + text + """
The data that need to be described is:"""+ str(imported_data) + """
Your generated content:"""



    # print(prompt)

    messages = [
        {"role": "user", "content": prompt}
    ]
    
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    
    model_inputs = tokenizer([text], return_tensors="pt").to(model.device)
    
    with torch.no_grad():
        generated_ids = model.generate(
            **model_inputs,
            max_new_tokens=1024,
            temperature=0.1,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )
    
    response = tokenizer.decode(generated_ids[0][len(model_inputs.input_ids[0]):], skip_special_tokens=True)

    return response

