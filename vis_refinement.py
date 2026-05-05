import json
import torch


def get_updated_json(text: str, explanatory_text_old, explanatory_text_new, json_result, model, tokenizer):
    prompt = """Role: You are an expert in geographical articles and geographical visualizations. Now, given an article and the JSON extracted and generated from it, the JSON abstracts the visual elements in the article, preparing for subsequent geographic visualization of the article. The JSON categorizes geographic elements into the following classes: "dot", "marker", "other icon", "trajectory", "line", "direction", "irregular area", and "regular shape". 
Now I will provide you with the geographic article, as well as the JSON of a type of geographic elements extracted from it (which will be one of the eight categories mentioned above), and I will also attach explanatory text for the interpretation of the JSON. But now that users have updated the explanatory text, you need to update the JSON based on the changes before and after the explanatory text (i.e. the user's intention). 

1. An example
The article: On the first day, I arrived at Hangzhou East Station, then went to West Lake Scenic Area for sightseeing, and finally stayed at West Lake State Guesthouse. The next day, we first went to Hangzhou Olympic Sports Center to watch a wonderful basketball game, then visited Xixi Wetland, and finally arrived at Hangzhou West Station, ending our journey.
The JSON:{"trajectory": [
        {
            "id": 1,
            "name": "trajectory 1",
            "sequence": [
                "Hangzhou East Station",
                "West Lake Scenic Area",
                "West Lake State Guesthouse"
            ],
            "visualEncoding": {
                "color": "pink",
                "strokeWidth": "1",
                "style": "solid"
            }
        },
        {
            "id": 2,
            "name": "trajectory 2",
            "sequence": [
                "Hangzhou Olympic Sports Center",
                "Xixi Wetland",
                "Hangzhou West Station"
            ],
            "visualEncoding": {
                "color": "green",
                "strokeWidth": "1",
                "style": "solid"
            }
        }
    ]}
The explanatory text (old): Trajectory 1: Connect Hangzhou East Station, West Lake Scenic Area, and West Lake State Guesthouse.\nTrajectory 2: Connect Hangzhou Olympic Sports Center, Xixi Wetland, and Hangzhou West Station.
The explanatory text (new): Trajectory 1: Connect Hangzhou East Station, West Lake Scenic Area, and West Lake State Guesthouse.\nTrajectory 2: Connect West Lake State Guesthouse, Hangzhou Olympic Sports Center, Xixi Wetland, and Hangzhou West Station.

So from the author's updated explanatory text, we can see the author's intention that West Lake State Guesthouse, as the starting point of the first day, must also be the starting point of the second day, so it should not be missed in the trajectory of the second day. So your output (the updated JSON) should be:
{"trajectory": [
        {
            "id": 1,
            "name": "trajectory 1",
            "sequence": [
                "Hangzhou East Station",
                "West Lake Scenic Area",
                "West Lake State Guesthouse"
            ],
            "visualEncoding": {
                "color": "pink",
                "strokeWidth": "1",
                "style": "solid"
            }
        },
        {
            "id": 2,
            "name": "trajectory 2",
            "sequence": [
                "West Lake State Guesthouse",
                "Hangzhou Olympic Sports Center",
                "Xixi Wetland",
                "Hangzhou West Station"
            ],
            "visualEncoding": {
                "color": "green",
                "strokeWidth": "1",
                "style": "solid"
            }
        }
    ]}


2. Output format
Your output must be in JSON format, only modifying the content of the original JSON.

3. Your task
Analyze the following article and corresponding JSON, and generate the updated JSON based on the changes of the explanatory text. 
The geographical article: """ + text + """
The explanatory text (old): """+ explanatory_text_old + """
The explanatory text (updated): """+ explanatory_text_new + """
The original json: """+ str(json_result) + """
Please output the updated json:"""
    

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
    














def get_trajectory_to_direction(text: str, model, tokenizer):
    prompt = """【Role】You are an expert in geographical knowledge and geographical writing. I have a text containing geographical information that I need to convert into JSON format. The purpose of this is to convert the geographic article into formalized JSON, which can then be easily used to generate corresponding geographical visualizations, thus laying the groundwork for creating geographical maps for articles.

However, during the JSON conversion process, the text, which should (correctly) be interpreted as describing "directions", has been inadvertently (incorrectly) interpreted as describing "trajectories". Therefore, I will provide you with the original text and the incorrect JSON, and ask you to provide the corrected JSON.

【Examples】
Suppose the given geographical text is: "He stood atop Tianmu Mountain, gazing at the distant Xixi Wetland, Hangzhou's urban green lung and a vast city park."
The current incorrect JSON may misinterpret it as a trajectory, specifically in the form of:
{
"trajectory": [
{
"id": 1,
"name": "trajectory 1",
"sequence": ["Tianmu Mountain", "Xixi Wetland"],
"visualEncoding": {"color": "pink", "strokeWidth": "1", "style": "solid"}
}
]
}
However, in reality, what the text describes, if drawn as a geographic visualization, should not be a trajectory (a trajectory should be the movement, travel, or journey of a person or object), but rather an action of looking out, i.e., a directional arrow from Tianmu Mountain to Xixi Wetland. Therefore, the correct JSON should be:
{
"direction": [
{
"id": 1,
"name": "direction 1",
"from": "Tianmu Mountain",
"to": "the Xixi Wetland",
"visualEncoding": {"color": "pink", "strokeWidth": "1"}
}
]
}

【Output Format】
The output must be in strict JSON format, as in the previous example, and cannot contain any other content or explanatory statements.


【Your Task】Now, the geographical text is: """ + text + """ 
Your output (the correct JSON):"""


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



def get_trajectory_to_line(text: str, model, tokenizer):
    prompt = """【Role】You are an expert in geographical knowledge and geographical writing. I have a text containing geographical information that I need to convert into JSON format. The purpose of this is to convert the geographic article into formalized JSON, which can then be easily used to generate corresponding geographical visualizations, thus laying the groundwork for creating geographical maps for articles.

However, during the JSON conversion process, the text, which should (correctly) be interpreted as describing "lines", has been inadvertently (incorrectly) interpreted as describing "trajectories". Therefore, I will provide you with the original text and the incorrect JSON, and ask you to provide the corrected JSON.

【Examples】
Suppose the given geographical text is: "Tianmushan Road and Xixi Road are two important roads in Hangzhou's old city, both located north of the Qiantang River. National Highway G104, however, runs south of the Qiantang River. The entire Qiantang River flows through the city."
The current incorrect JSON may misinterpret it as a trajectory. However, in reality, what the text describes, if drawn as a geographic visualization, should not be a trajectory (a trajectory should be the movement, travel, or journey of a person or object), but rather several lines such as Tianmushan Road and Qiantang River. Therefore, the correct JSON should be:
{
"line": [
    {
    "id": 1,
    "name": "line 1",
    "content": "Tianmushan Road",
    "visualEncoding": {"color": "blue", "opacity": 1}
    },
    {
    "id": 2,
    "name": "line 2",
    "content": "Xixi Road",
    "visualEncoding": {"color": "blue", "opacity": 1}
    },
    {
    "id": 3,
    "name": "line 3",
    "content": "Qiantang River",
    "visualEncoding": {"color": "blue", "opacity": 1}
    }
]
}

【Output Format】
The output must be in strict JSON format, as in the previous example, and cannot contain any other content or explanatory statements.


【Your Task】Now, the geographical text is: """ + text + """ 
Your output (the correct JSON):"""


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



def get_line_to_trajectory(text: str, model, tokenizer):
    prompt = """【Role】You are an expert in geographical knowledge and geographical writing. I have a text containing geographical information that I need to convert into JSON format. The purpose of this is to convert the geographic article into formalized JSON, which can then be easily used to generate corresponding geographical visualizations, thus laying the groundwork for creating geographical maps for articles.

However, during the JSON conversion process, the text, which should (correctly) be interpreted as describing "trajectories", has been inadvertently (incorrectly) interpreted as describing "lines". Therefore, I will provide you with the original text and the incorrect JSON, and ask you to provide the corrected JSON.

【Examples】
Suppose the given geographical text is: "Our first day in Tokyo began at the iconic Senso-ji Temple,Tokyo's oldest Buddhist temple. The vibrant Nakamise shopping street leading up to the temple was bustling withtourists and locals alike, offering a variety of traditional snacks and souvenirs. After lunch, we headed to Akihabara, the electronics and anime mecca of Tokyo. We explored several multi-story electronics stores and visited a maidcafe for a unique cultural experience. In the evening, we drove through the vicinity of the Imperial Palace and saw it, and finally arrived at Odaiba, a large artificial island inTokyo Bay, where we enjoyed the futuristic architecture. We started our second day in the fabulous and charming neighborhood of Nakameguro. We took a leisurely morning stroll along the Meguro River, admiring the cherry trees lining its banks. The hip cafes and boutiques of the area provided a relaxing start to our day. In the afternoon, we headed to the lively Shibuya district that famous for its busy pedestrian crossing. We also paid our respects at the statueof Hachiko, the loyal dog, and indulged in some shopping atthe trendy department stores that Shibuya is known for. As the day progressed, we made our way to Shinjuku for ourfinal stop. Finally we arrived at the Tokyo Metropolitan Government Building. The free observation decks offered usbreathtaking panoramic views of the city and the twinkling lights of Tokyo at dusk provided a fitting end to our exciting day of exploration."
The current incorrect JSON may misinterpret it as several lines. However, in reality, what the text describes, if drawn as a geographic visualization, should not be lines, but rather trajectories (a trajectory should be the movement, travel, or journey of a person or object). Therefore, the correct JSON should be:
{
"trajectory": [
{
"id": 1,
"name": "trajectory 1",
"sequence": ["Senso-ji Temple", "Akihabara", "Imperial Palace", "Odaiba"],
"visualEncoding": {"color": "pink", "strokeWidth": "1", "style": "solid"}
},
{
"id": 2,
"name": "trajectory 2",
"sequence": ["Nakameguro", "Meguro River", "Shibuya district", "Tokyo Metropolitan Government Building"],
"visualEncoding": {"color": "green", "strokeWidth": "1", "style": "solid"}
}
]
}


【Output Format】
The output must be in strict JSON format, as in the previous example, and cannot contain any other content or explanatory statements.


【Your Task】Now, the geographical text is: """ + text + """ 
Your output (the correct JSON):"""


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




def get_line_to_direction(text: str, model, tokenizer):
    prompt = """【Role】You are an expert in geographical knowledge and geographical writing. I have a text containing geographical information that I need to convert into JSON format. The purpose of this is to convert the geographic article into formalized JSON, which can then be easily used to generate corresponding geographical visualizations, thus laying the groundwork for creating geographical maps for articles.

However, during the JSON conversion process, the text, which should (correctly) be interpreted as describing "directions", has been inadvertently (incorrectly) interpreted as describing "lines". Therefore, I will provide you with the original text and the incorrect JSON, and ask you to provide the corrected JSON.

【Examples】
Suppose the given geographical text is: "He stood atop Tianmu Mountain, gazing at the distant Xixi Wetland, Hangzhou's urban green lung and a vast city park."
The current incorrect JSON may misinterpret it as several lines. However, in reality, what the text describes, if drawn as a geographic visualization, should not be lines, but rather an action of looking out, i.e., a directional arrow from Tianmu Mountain to Xixi Wetland. Therefore, the correct JSON should be:
{
"direction": [
{
"id": 1,
"name": "direction 1",
"from": "Tianmu Mountain",
"to": "the Xixi Wetland",
"visualEncoding": {"color": "pink", "strokeWidth": "1"}
}
]
}


【Output Format】
The output must be in strict JSON format, as in the previous example, and cannot contain any other content or explanatory statements.


【Your Task】Now, the geographical text is: """ + text + """ 
Your output (the correct JSON):"""


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



def get_direction_to_trajectory(text: str, model, tokenizer):
    prompt = """【Role】You are an expert in geographical knowledge and geographical writing. I have a text containing geographical information that I need to convert into JSON format. The purpose of this is to convert the geographic article into formalized JSON, which can then be easily used to generate corresponding geographical visualizations, thus laying the groundwork for creating geographical maps for articles.

However, during the JSON conversion process, the text, which should (correctly) be interpreted as describing "trajectories", has been inadvertently (incorrectly) interpreted as describing "directions". Therefore, I will provide you with the original text and the incorrect JSON, and ask you to provide the corrected JSON.

【Examples】
Suppose the given geographical text is: "Our first day in Tokyo began at the iconic Senso-ji Temple,Tokyo's oldest Buddhist temple. The vibrant Nakamise shopping street leading up to the temple was bustling withtourists and locals alike, offering a variety of traditional snacks and souvenirs. After lunch, we headed to Akihabara, the electronics and anime mecca of Tokyo. We explored several multi-story electronics stores and visited a maidcafe for a unique cultural experience. In the evening, we drove through the vicinity of the Imperial Palace and saw it, and finally arrived at Odaiba, a large artificial island inTokyo Bay, where we enjoyed the futuristic architecture. We started our second day in the fabulous and charming neighborhood of Nakameguro. We took a leisurely morning stroll along the Meguro River, admiring the cherry trees lining its banks. The hip cafes and boutiques of the area provided a relaxing start to our day. In the afternoon, we headed to the lively Shibuya district that famous for its busy pedestrian crossing. We also paid our respects at the statueof Hachiko, the loyal dog, and indulged in some shopping atthe trendy department stores that Shibuya is known for. As the day progressed, we made our way to Shinjuku for ourfinal stop. Finally we arrived at the Tokyo Metropolitan Government Building. The free observation decks offered usbreathtaking panoramic views of the city and the twinkling lights of Tokyo at dusk provided a fitting end to our exciting day of exploration."
The current incorrect JSON may misinterpret it as several directions. However, in reality, what the text describes, if drawn as a geographic visualization, should not be directions, but rather trajectories (a trajectory should be the movement, travel, or journey of a person or object). Therefore, the correct JSON should be:
{
"trajectory": [
{
"id": 1,
"name": "trajectory 1",
"sequence": ["Senso-ji Temple", "Akihabara", "Imperial Palace", "Odaiba"],
"visualEncoding": {"color": "pink", "strokeWidth": "1", "style": "solid"}
},
{
"id": 2,
"name": "trajectory 2",
"sequence": ["Nakameguro", "Meguro River", "Shibuya district", "Tokyo Metropolitan Government Building"],
"visualEncoding": {"color": "green", "strokeWidth": "1", "style": "solid"}
}
]
}


【Output Format】
The output must be in strict JSON format, as in the previous example, and cannot contain any other content or explanatory statements.


【Your Task】Now, the geographical text is: """ + text + """ 
Your output (the correct JSON):"""


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



def get_direction_to_line(text: str, model, tokenizer):
    prompt = """【Role】You are an expert in geographical knowledge and geographical writing. I have a text containing geographical information that I need to convert into JSON format. The purpose of this is to convert the geographic article into formalized JSON, which can then be easily used to generate corresponding geographical visualizations, thus laying the groundwork for creating geographical maps for articles.

However, during the JSON conversion process, the text, which should (correctly) be interpreted as describing "lines", has been inadvertently (incorrectly) interpreted as describing "directions". Therefore, I will provide you with the original text and the incorrect JSON, and ask you to provide the corrected JSON.

【Examples】
Suppose the given geographical text is: "Tianmushan Road and Xixi Road are two important roads in Hangzhou's old city, both located north of the Qiantang River. National Highway G104, however, runs south of the Qiantang River. The entire Qiantang River flows through the city."
The current incorrect JSON may misinterpret it as a trajectory. However, in reality, what the text describes, if drawn as a geographic visualization, should not be a direction, but rather several lines such as Tianmushan Road and Qiantang River. Therefore, the correct JSON should be:
{
"line": [
    {
    "id": 1,
    "name": "line 1",
    "content": "Tianmushan Road",
    "visualEncoding": {"color": "blue", "opacity": 1}
    },
    {
    "id": 2,
    "name": "line 2",
    "content": "Xixi Road",
    "visualEncoding": {"color": "blue", "opacity": 1}
    },
    {
    "id": 3,
    "name": "line 3",
    "content": "Qiantang River",
    "visualEncoding": {"color": "blue", "opacity": 1}
    }
]
}



【Output Format】
The output must be in strict JSON format, as in the previous example, and cannot contain any other content or explanatory statements.


【Your Task】Now, the geographical text is: """ + text + """ 
Your output (the correct JSON):"""


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



def get_regular_to_irregular(text: str, model, tokenizer):
    prompt = """【Role】You are an expert in geographical knowledge and geographical writing. I have a text containing geographical information that I need to convert into JSON format. The purpose of this is to convert the geographic article into formalized JSON, which can then be easily used to generate corresponding geographical visualizations, thus laying the groundwork for creating geographical maps for articles.

However, during the JSON conversion process, the text, which should (correctly) be interpreted as describing "irregular area", has been inadvertently (incorrectly) interpreted as describing "regular shape". Therefore, I will provide you with the original text and the incorrect JSON, and ask you to provide the corrected JSON.

【Examples】
Suppose the given geographical text is: "Hangzhou has many famous scenic spots and historical sites, such as West Lake Scenic Area, Xixi National Wetland Park, and Zhejiang University Zijingang Campus."
The current incorrect JSON may misinterpret it as regular shapes. However, in reality, what the text describes, if drawn as a geographic visualization, should not be regular shapes (i.e., some regular shapes, such as circles and rectangles), but rather irregular areas (these areas are irregularly shaped regions on a map, and it is usually necessary to obtain the geojson of these place names before their outlines can be drawn on the map). Therefore, the correct JSON should be:
{
"irregular area": [
    {
        "id": 1,
        "name": "region 1"
        "content": "West Lake Scenic Area"
        "visualEncoding": {"color": "pink", "opacity": 1}
    },
    {
        "id": 2,
        "name": "region 2"
        "content": "Xixi National Wetland Park"
        "visualEncoding": {"color": "pink", "opacity": 1}
    },
    {
        "id": 3,
        "name": "region 3"
        "content": "Zhejiang University Zijingang Campus"
        "visualEncoding": {"color": "pink", "opacity": 1}
    }
]
}


【Output Format】
The output must be in strict JSON format, as in the previous example, and cannot contain any other content or explanatory statements.


【Your Task】Now, the geographical text is: """ + text + """ 
Your output (the correct JSON):"""


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



def get_irregular_to_regular(text: str, model, tokenizer):
    prompt = """【Role】You are an expert in geographical knowledge and geographical writing. I have a text containing geographical information that I need to convert into JSON format. The purpose of this is to convert the geographic article into formalized JSON, which can then be easily used to generate corresponding geographical visualizations, thus laying the groundwork for creating geographical maps for articles.

However, during the JSON conversion process, the text, which should (correctly) be interpreted as describing "regular shape", has been inadvertently (incorrectly) interpreted as describing "irregular area". Therefore, I will provide you with the original text and the incorrect JSON, and ask you to provide the corrected JSON.

【Examples】
Suppose the given geographical text is: "Hangzhou has strict height restrictions, such as a 5km radius around Xixi Wetland, a 10km radius around West Lake Scenic Area, and a 15km radius around Xiaoshan Airport."
The current incorrect JSON may misinterpret it as irregular areas, specifically in the form of:
{
"irregular area": [
    {
        "id": 1,
        "name": "region 1"
        "content": "West Lake Scenic Area"
        "visualEncoding": {"color": "pink", "opacity": 1}
    },
    {
        "id": 2,
        "name": "region 2"
        "content": "Xixi National Wetland Park"
        "visualEncoding": {"color": "pink", "opacity": 1}
    },
    {
        "id": 3,
        "name": "region 3"
        "content": "Zhejiang University Zijingang Campus"
        "visualEncoding": {"color": "pink", "opacity": 1}
    }
]
}
However, in reality, what the text describes, if drawn as a geographic visualization, should not be irregular areas (these areas are irregularly shaped regions on a map, and it is usually necessary to obtain the geojson of these place names before their outlines can be drawn on the map), but rather regular shapes (i.e., some regular shapes, such as circles and rectangles). This is because if we want to geographically visualize the intent in the text, we should not draw the outlines of these three locations, but rather draw circles with their respective radii centered on each location to represent the height-restricted areas in the text. This is the correct visualization intent. Therefore, the correct JSON should be:
{
"regular shape": [
{
"id": 1,
"type": "circle",
"center": "Xixi Wetland",
"radius": 5,
"visualEncoding": {"color": "pink", "opacity": 1}
},
{
"id": 2,
"type": "circle",
"center": "West Lake Scenic Area",
"radius": 10,
"visualEncoding": {"color": "pink", "opacity": 1}
},
{
"id": 3,
"type": "circle",
"center": "Xiaoshan Airport",
"radius": 15,
"visualEncoding": {"color": "pink", "opacity": 1}
}
]
}


【Output Format】
The output must be in strict JSON format, as in the previous example, and cannot contain any other content or explanatory statements.


【Your Task】Now, the geographical text is: """ + text + """ 
Your output (the correct JSON):"""


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




def get_categorical(text: str, model, tokenizer):
    prompt = """Role: You are an expert in geographical articles and geographical visualizations.
    Now there is a text containing geographic information. In order to realize geographic visualization of the text, I need to draw the place names mentioned in it on the map. Since not all place names have the same visual encoding, we need to give different place names different visual encodings according to the specific description of the text. We are now specifically considering an encoding method that we call categorical type.


1. Detailed descriptions of categorical type

【categorical】
The categorical type involves assigning different visual encoding to different objects based on their categories (usually two categories). Objects of the same type are encoded consistently, while objects of different types are encoded differently. For example, if the text mentions that certain areas have one characteristic while other areas have another, different colors can be assigned to different regions on the map based on these categories. Another example is that when a travelogue describes the itinerary for the first day and the second day separately, the two trajectories can be encoded using different line types, thicknesses, or colors. Additionally, a news report might mention the disaster situations in several locations, with one particular place being the most severely affected.




2. Examples for categorical type

【two examples for categorical】
Example 1 for categorical.
The text is "Several provinces across the country were affected by the typhoon, including Shanghai, Zhejiang, Jiangsu and Fujian, which were severely affected, but Guangdong and Hebei suffered minimal damage."
"Shanghai", "Zhejiang", "Jiangsu" and "Fujian", these areas are colored red on the map to highlight how badly they were hit.
"Guangdong" and "Hebei", these areas are colored green on the map to indicate they were least affected.
So the returned result must in JSON format, as shown below:
{
    "purpose": "categorical",
    "place_name1": ["Shanghai", "Zhejiang", "Jiangsu", "Fujian"],
    "color1": "red",
    "place_name2": ["Guangdong", "Hebei"], 
    "color2": "blue" 
}

Example 2 for categorical.
The text is "This shift has significantly impacted the electoral landscape. The latest poll from August 28 shows Harris surging ahead of Trump in Michigan and Wisconsin, reversing earlier deficits. We highlight these two states in yellow in the map. However, Republicans still maintain a slim advantage in states like Georgia and Arizona. Pennsylvania, highlighted in yellow on the map, has become a hotly contested battleground between Democrats and Republicans. This indicates the election's volatility and the crucial importance of every vote in this highly uncertain race."
If the text mentions the color of a place name or a category of place names, the JSON result should use. If the text does not mention the color of this category of place name, you can just recommend it based on the meaning of the text.
So the returned result must in JSON format, as shown below:
{
    "purpose": "categorical",
    "place_name1": ["Michigan", "Wisconsin"],
    "color1": "yellow",
    "place_name2": ["Georgia", "Arizona", "Pennsylvania"], 
    "color2": "red" 
}



3.Output Format
Your output can only be the final JSON result, without any explanation of the intermediate steps. Below are output format examples for categorical type.
An example foramt for categorical type:
{
    "purpose": "categorical",
    "place_name1": ["Michigan", "Wisconsin"],
    "color1": "yellow",
    "place_name2": ["Georgia", "Arizona", "Pennsylvania"], 
    "color2": "red" 
}


"""

    
    if not imported_data:
        prompt += """ 
5. Your Task
Analyze the following text, and generate the output in the JSON format.
Text to Analyze: """ + input_text + """
Output:"""
    else:
        prompt += """ 
5. Your Task
Analyze the following text and imported data, and generate the output in the JSON format.
Text to Analyze: """ + input_text + """
Imported data: """ + imported_data + """
Output:"""


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



def get_numerical(input_text: str, imported_data, model, tokenizer):
    prompt = """Role: You are an expert in geographical articles and geographical visualizations.
    Now there is a text containing geographic information. In order to realize geographic visualization of the text, I need to draw the place names mentioned in it on the map. Since not all place names have the same visual encoding, we need to give different place names different visual encodings according to the specific description of the text. We are now specifically considering an encoding method that we call numerical type.


1. Detailed descriptions of numerical type

【numerical】
The numerical type involves encoding values for different objects as a continuously changing function, rather than the discrete approach of the first case. For example, a political news article might mention the election support rates in different communities. On the map, the redder a community’s color, the higher its support rate for one candidate, while the bluer a community’s color, the higher its support rate for the other candidate.


2. Examples for numerical type

【an example for numerical】
The text is "In Texas, Trump's approval rating is much higher than Biden's, reaching an astonishing 80%. In addition, Wisconsin, Utah and other places are also Trump's home turf. However, Biden made a comeback in Washington State, where he received 70% approval rating."
In this example, the text is quite simple, so in addition to the text, the prompt may also provide specific data (such as a detailed table of support rates for each state). Here we assume that the data is roughly(###################The contents within are data):
###################
state  rate(Trump)  rate(Biden)
Texas  0.8  0.2
Wisconsin  0.7  0.3
...
Washington 0.3  0.7
###################
Then you should analyze the text and data and find the two extreme values ​​(if there is no data, just analyze the text). In this example, the extreme values ​​should be the states with the highest support for Trump and the states with the highest support for Biden, which are Texas and Washington.
So the result is:
{
    "purpose": "numerical",
    "place_name1": "Texas",
    "attribute1" : "rate(Trump)",
    "color1": "light red",
    "place_name2": "Washington",
    "attribute2" : "rate(Biden)",
    "color2": "light blue"
}


3. An important note
In the 【An Example for Numerical】 section, data is provided in addition to text. However, it's important to note that data is not always available; it depends on whether the user has imported data. If data is available, you can combine it for analysis. For example, the 【An Example for Numerical】 section allows you to determine the two states with the highest relative support rates for Trump and Biden based on the data. If no data is available, you only need to analyze the plain text content.


4.Output Format
Your output can only be the final JSON result, without any explanation of the intermediate steps. Below is an output format example for numerical type.

An example foramt for numerical type:
{
    "purpose": "numerical",
    "place_name1": "Texas",
    "attribute1" : "rate(Trump)",
    "color1": "light red",
    "place_name2": "Washington",
    "attribute2" : "rate(Biden)",
    "color2": "light blue"
}

"""

    if not imported_data:
        prompt += """ 
5. Your Task
Analyze the following text, and generate the output in the JSON format.
Text to Analyze: """ + input_text + """
Output:"""
    else:
        prompt += """ 
5. Your Task
Analyze the following text and imported data, and generate the output in the JSON format.
Text to Analyze: """ + input_text + """
Imported data: """ + imported_data + """
Output:"""
    

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
