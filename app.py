from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch
import json
import re
from gen_vis import parse_text_to_mapbackground, parse_text_to_mapscope, parse_text_to_POINT, parse_text_to_LINE, parse_text_to_AREA, generate_explanatory_text, get_categorical_type
from vis_refinement import get_updated_json, get_trajectory_to_direction, get_trajectory_to_line, get_line_to_trajectory, get_line_to_direction, get_direction_to_trajectory, get_direction_to_line, get_regular_to_irregular, get_irregular_to_regular, get_categorical, get_numerical
from gen_text import get_textual_descriptions_for_geo_element, get_generated_text_based_on_a_place, get_generated_descriptions_of_spatial_relationships, get_generated_analytical_summary_of_the_data

app = Flask(__name__)
CORS(app)


# Global variable storage model and tokenizer
model = None
tokenizer = None

def initialize_qwen_model():
    """Initialize Qwen model"""
    global model, tokenizer
    
    print("Initializing Qwen model ...")
    
    try:
        model_name = "Qwen/Qwen2.5-7B-Instruct"
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        # Load the model and select the device based on your hardware
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
            device_map="auto" if device == "cuda" else None
        )
        
        if device == "cpu":
            model = model.to(device)
        
        print(f"The Qwen model has been successfully loaded into {device}")
        
    except Exception as e:
        print(f"Model initialization failed: {e}")
        model = None
        tokenizer = None


@app.route('/get_mapbackground', methods=['POST'])
def get_mapbackground():
    
    data = request.get_json()
    if not data or 'text' not in data:
            return jsonify({
                "status": "error", 
                "message": "Please provide the text content to be parsed"
            }), 400
    input_text = data['text']

    mapbackground = "standard map"
    mapbackground = parse_text_to_mapbackground(input_text, model, tokenizer)
    mapbackground = mapbackground.lower()
        
    if mapbackground not in ["standard map", "satellite map", "traffic map", "dark mode map"]:
        mapbackground = "standard map"
        
    return mapbackground


@app.route('/get_mapscope', methods=['POST'])
def get_mapscope():
    
    data = request.get_json()
    if not data or 'text' not in data:
            return jsonify({
                "status": "error", 
                "message": "Please provide the text content to be parsed"
            }), 400
    input_text = data['text']

    mapscope = parse_text_to_mapscope(input_text, model, tokenizer)

    mapscope = mapscope.strip().removeprefix('```json').removeprefix('```').removesuffix('```').strip()
    # mapscope = json.loads(mapscope)
    print(mapscope)
        
    return mapscope


@app.route('/text2json', methods=['POST'])
def text2json():
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({
                "status": "error", 
                "message": "Please provide the text content to be parsed"
            }), 400
        
        input_text = data['text']
        # print(input_text)
        
        try:
            parsed_result1 = parse_text_to_POINT(input_text, model, tokenizer)
            cleaned_result1 = clean_json_string(parsed_result1)
            print("result1:\n", cleaned_result1)
            
            parsed_result2 = parse_text_to_LINE(input_text, model, tokenizer)
            cleaned_result2 = clean_json_string(parsed_result2)
            print("result2:\n", cleaned_result2)
            
            parsed_result3 = parse_text_to_AREA(input_text, model, tokenizer)
            cleaned_result3 = clean_json_string(parsed_result3)
            print("result3:\n", cleaned_result3)
            

            parsed_result = {**json.loads(cleaned_result1), **json.loads(cleaned_result2), **json.loads(cleaned_result3)}
            print("The final results:\n", parsed_result)

            return parsed_result
            
            # return jsonify({
            #     "status": "success", 
            #     "message": "The text has been successfully parsed into JSON format",
            #     "content": parsed_result
            # })
            
        except Exception as e:
            return jsonify({
                "dot": [], 
                "marker": [],
                "other icon": [],
                "trajectory": [],
                "line": [],
                "direction": [],
                "regular shape": [],
                "irregular area":[]
            })
            
    except Exception as e:
        return jsonify({
                "dot": [], 
                "marker": [],
                "other icon": [],
                "trajectory": [],
                "line": [],
                "direction": [],
                "regular shape": [],
                "irregular area":[]
            })






@app.route('/get_explanatory_text', methods=['POST'])
def get_explanatory_text():
    data = request.get_json()
    input_text = data['text']
    json_result = data['json_result']
    
    explanatory_text = generate_explanatory_text(input_text, json_result, model, tokenizer)
    explanatory_text = clean_json_string(explanatory_text)
    print(explanatory_text)
    
    return explanatory_text


@app.route('/update_explanatory_text', methods=['POST'])
def update_explanatory_text():
    data = request.get_json()
    text = data['text'] 
    explanatory_text_old = data['explanatory_text_old'] 
    explanatory_text_new = data['explanatory_text_new']
    json_result = data['json_result'] 
    
    updated_json = get_updated_json(text, explanatory_text_old, explanatory_text_new, json_result, model, tokenizer)
    updated_json = clean_json_string(updated_json)
    print(updated_json)
    
    return updated_json




@app.route('/get_purpose', methods=['POST'])
def get_purpose():
    data = request.get_json()
    input_text = data['text']
    imported_data = None
    imported_data = data['imported_data']
    if not imported_data:
        imported_data = None
        
    categorical_or_numerical = get_categorical_type(input_text, imported_data, model, tokenizer)
    categorical_or_numerical = clean_json_string(categorical_or_numerical)
    print(categorical_or_numerical)
    
    return categorical_or_numerical




@app.route('/modify_tag_LINE', methods=['POST'])
def modify_tag_LINE():
    data = request.get_json()
    text = data['text']
    old_tag = data['old_tag']
    new_tag = data['new_tag']

    if old_tag == "trajectory" and new_tag == "direction": 
        updated_json = get_trajectory_to_direction(text, model, tokenizer)
        updated_json = clean_json_string(updated_json)
        print(updated_json)
        
        explanatory_text = generate_explanatory_text(text, updated_json, model, tokenizer)
        explanatory_text = clean_json_string(explanatory_text)
        print(explanatory_text)
        return jsonify({
            "updated_json": updated_json,
            "explanatory_text": explanatory_text
        })
    elif old_tag == "trajectory" and new_tag == "line":
        updated_json = get_trajectory_to_line(text, model, tokenizer)
        updated_json = clean_json_string(updated_json)
        print(updated_json)
        
        explanatory_text = generate_explanatory_text(text, updated_json, model, tokenizer)
        explanatory_text = clean_json_string(explanatory_text)
        print(explanatory_text)
        return jsonify({
            "updated_json": updated_json,
            "explanatory_text": explanatory_text
        })
    elif old_tag == "line" and new_tag == "trajectory":
        updated_json = get_line_to_trajectory(text, model, tokenizer)
        updated_json = clean_json_string(updated_json)
        print(updated_json)
        
        explanatory_text = generate_explanatory_text(text, updated_json, model, tokenizer)
        explanatory_text = clean_json_string(explanatory_text)
        print(explanatory_text)
        return jsonify({
            "updated_json": updated_json,
            "explanatory_text": explanatory_text
        })
    elif old_tag == "line" and new_tag == "direction":
        updated_json = get_line_to_direction(text, model, tokenizer)
        updated_json = clean_json_string(updated_json)
        print(updated_json)
        
        explanatory_text = generate_explanatory_text(text, updated_json, model, tokenizer)
        explanatory_text = clean_json_string(explanatory_text)
        print(explanatory_text)
        return jsonify({
            "updated_json": updated_json,
            "explanatory_text": explanatory_text
        })
    elif old_tag == "direction" and new_tag == "trajectory":
        updated_json = get_direction_to_trajectory(text, model, tokenizer)
        updated_json = clean_json_string(updated_json)
        print(updated_json)
        
        explanatory_text = generate_explanatory_text(text, updated_json, model, tokenizer)
        explanatory_text = clean_json_string(explanatory_text)
        print(explanatory_text)
        return jsonify({
            "updated_json": updated_json,
            "explanatory_text": explanatory_text
        })
    elif old_tag == "direction" and new_tag == "line":
        updated_json = get_direction_to_line(text, model, tokenizer)
        updated_json = clean_json_string(updated_json)
        print(updated_json)
        
        explanatory_text = generate_explanatory_text(text, updated_json, model, tokenizer)
        explanatory_text = clean_json_string(explanatory_text)
        print(explanatory_text)
        return jsonify({
            "updated_json": updated_json,
            "explanatory_text": explanatory_text
        })

        

@app.route('/modify_tag_AREA', methods=['POST'])
def modify_tag_AREA():
    data = request.get_json()
    text = data['text']
    old_tag = data['old_tag']
    new_tag = data['new_tag']

    if old_tag == "regular" and new_tag == "irregular":
        updated_json = get_regular_to_irregular(text, model, tokenizer)
        updated_json = clean_json_string(updated_json)
        print(updated_json)
        
        explanatory_text = generate_explanatory_text(text, updated_json, model, tokenizer)
        explanatory_text = clean_json_string(explanatory_text)
        print(explanatory_text)
        return jsonify({
            "updated_json": updated_json,
            "explanatory_text": explanatory_text
        })    
    elif old_tag == "irregular" and new_tag == "regular": 
        updated_json = get_irregular_to_regular(text, model, tokenizer)
        updated_json = clean_json_string(updated_json)
        print(updated_json)
        
        explanatory_text = generate_explanatory_text(text, updated_json, model, tokenizer)
        explanatory_text = clean_json_string(explanatory_text)
        print(explanatory_text)
        return jsonify({
            "updated_json": updated_json,
            "explanatory_text": explanatory_text
        })

    

@app.route('/modify_major_tag', methods=['POST'])
def modify_major_tag():
    
    data = request.get_json()
    text = data['text']
    new_tag_major_category = data['new_tag_major_category']
    new_tag_sub_category = data['new_tag_sub_category']

    if new_tag_major_category == "point":
        parsed_result1 = parse_text_to_POINT(text, model, tokenizer)
        cleaned_result1 = clean_json_string(parsed_result1)
        print(cleaned_result1)

        cleaned_result1 = json.loads(cleaned_result1)
        result = cleaned_result1[new_tag_sub_category]
        return result
    elif new_tag_major_category == "line":
        parsed_result2 = parse_text_to_LINE(text, model, tokenizer)
        cleaned_result2 = clean_json_string(parsed_result2)
        print(cleaned_result2)

        cleaned_result2 = json.loads(cleaned_result2)
        result = cleaned_result2[new_tag_sub_category]
        return result
    elif new_tag_major_category == "area":
        parsed_result3 = parse_text_to_AREA(text, model, tokenizer)
        cleaned_result3 = clean_json_string(parsed_result3)
        print(cleaned_result3)

        cleaned_result3 = json.loads(cleaned_result3)
        result = cleaned_result3[new_tag_sub_category]
        return result
            


@app.route('/modify_tag_categorical_or_numerical', methods=['POST'])
def modify_tag():

    input_text = data['text']
    imported_data = None
    imported_data = data['imported_data']
    if not imported_data:
        imported_data = None
    new_tag = data['new_tag']

    if new_tag == "categorical":
        result = get_categorical(input_text, imported_data, model, tokenizer)
        result = clean_json_string(result)
        print(result)
    elif new_tag == "numerical":
        result = get_numerical(input_text, imported_data, model, tokenizer)
        result = clean_json_string(result)
        print(result)

    return result













@app.route('/generate_textual_descriptions_for_geo_element', methods=['POST'])
def generate_textual_descriptions_for_geo_element():
    data = request.get_json()
    text = data['text']
    geo_element = data['geo_element']

    generated_text = get_textual_descriptions_for_geo_element(text, geo_element, model, tokenizer)
    print(generated_text)

    return generated_text


@app.route('/continue_writing_based_on_a_place', methods=['POST'])
def continue_writing_based_on_a_place():
    data = request.get_json()
    text = data['text']
    place_name = data['place_name']

    generated_text = get_generated_text_based_on_a_place(text, place_name, model, tokenizer)
    print(generated_text)

    return generated_text


@app.route('/generate_descriptions_of_spatial_relationships', methods=['POST'])
def generate_descriptions_of_spatial_relationships():
    # Users only need to hold the Shift key and click on some generated visualization elements or other arbitrary locations on the map.
    # The system will then generate a textual description of the relationships among the selected elements.
    
    data = request.get_json()
    place_names = data['place_names']

    generated_text = get_generated_descriptions_of_spatial_relationships(place_names, model, tokenizer)
    print(generated_text)

    return generated_text


@app.route('/continue_writing_an_analytical_summary_of_the_data', methods=['POST'])
def continue_writing_an_analytical_summary_of_the_data():
    data = request.get_json()
    text = data['text']
    imported_data = data['imported_data']

    generated_text = get_generated_analytical_summary_of_the_data(text, imported_data, model, tokenizer)
    print(generated_text)

    return generated_text


    


@app.route('/health', methods=['GET'])
def health_check():
    model_status = "Loaded" if model is not None else "Not loaded"
    return jsonify({
        "status": "success",
        "model_status": model_status,
        "message": "The service is operating normally"
    })



def clean_json_string(s):
    s = re.sub(r'^```json\n', '', s) 
    s = re.sub(r'\n```$', '', s)     
    return s.strip()



if __name__ == '__main__':
    initialize_qwen_model()
    
    print("The Flask server is starting up ..")
    app.run(debug=True, port=5000, host='0.0.0.0')